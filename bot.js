//This is the main script for the bot. To start the bot, run this script with node
var port = 8080

try {
	var Discord = require("discord.js");
} catch (e){
	console.log("Please run npm install and ensure it passes with no errors!");
	process.exit();
}

try {
	var discord_auth = require('./auth.json');
} catch (e) {
	console.log("Auth file not found!");
}

var bot = new Discord.Client();

var http = require('http');
var fs = require('fs');
var Twitter = require('twitter');
var child_process = require('child_process');
var twitterBot = require('./nifty/twitter.js');
var decider = require('./nifty/decisions.js');
var gitHelper = require('./nifty/git.js');
var lastSeen = require('./nifty/lastseen.js');
var todo = require('./nifty/todo.js');
// var pastebin = require('./nifty/pastebin.js');

//initialize the twitterClient variable, but don't give it a value
var twitterClient;

//call checkRole(message.sender, message.server, 'role')
var checkRole = function(user, server, role){
	for (var i = 0; i < server.roles.length; i++){
		if(server.roles[i].name == role && user.hasRole(server.roles[i])){
			return true
		}
	}
	return false
}

var getMethod = function(argument){
	//Grab first word in a command
	if(argument.indexOf(' ') != -1){
		return argument.substring(0, argument.indexOf(' '));
	}else{
		return argument;
	}
}

var getParameter = function(argument){
	return argument.substring(argument.indexOf(' ')+1, argument.length);
}

var commands = {
	//example command object
	//each object has three attributes: process, usage, and description.
	//usage and description are to help users when they run !help
	//the process attribute contains the definition of a function which calls the desired feature,
	//which should be imported from a .js file stored in the nifty directory.
	//In general, one should design their functions to take a callback function as the last parameters, which
	//is to be defined in this object. The callback can handle things like messaging the channel or users.
	//'!example': {
		//process: function(message /*the message object*/, argument /*whatever follows a command (ex. 'hello' in !tweet hello)*/){
			//my_package.myFunction(foo, bar, callbackFunction(){
				//bot.sendMessage(channel, "Example callback executed")	
			//})
		//},
		//usage: "<arguments>", // Do not make usage property if command does not need adtl arguments.
		//description: "This is an example implementation of a command.",
	//},
	'!howtocode':{
		process: function(message, argument){
			bot.sendMessage(message.channel, "1. When in doubt, go straight to production.\n2. Everything gets console.log'd.\n3. Eat a banana.")
		},
		description: "Passes on our wisdom."
	},
	'!lastseen': {
		process: function(message, argument){
			lastSeen.lookup(argument, function(msg){
				bot.sendMessage(message.channel, msg);
			})
		},
		usage: "<username>",
		description: "Tells you the last time a user sent a message on discord, what they said, and where they said it."
	},
	'!twitter': {
		process: function(message, argument) {	

			var messageFunction = function(msg){
				bot.sendMessage(message.channel, msg);
			}

			var method = getMethod(argument);

			if (method === "initialize"){
				if (checkRole(message.author, message.server, 'developer')){
					twitterClient = twitterBot.initialize(messageFunction);
				}else{
					messageFunction("Sorry, you must have the role 'developer' to start up my twitter functions.");
				}
			}else if (method === "tweet"){
				var tweet = getParameter(argument);
				if (checkRole(message.author, message.server, 'tweeter')){
					twitterBot.postTweet(twitterClient, tweet, messageFunction);
				} else {
					messageFunction("Sorry, you must have the role 'tweeter' to post a tweet to @MarinMakers. Talk to an admin for permissions.")
				}
			}else if (method === "trending"){
				twitterBot.getTrending(twitterClient, messageFunction);
				//get trending tweets
				// twitterClient = twitterBot.getTrending(twitterClient, messageFunction);
				// messageFunction("This will eventually get trending tweets from twitter");
			}else if (method === "search"){
				//search twitter for the remainder of the argument
				var query = getParameter(argument);
				twitterBot.search(twitterClient, query, messageFunction);
			}else{
				messageFunction("Sorry, I can't tell what you're trying to do.");
			}
			
		},
		usage: "[add <tweet body>] [trending] [search <query>]",
		description: "Post a tweet to @MarinMakers (iff you have the role 'tweeter'), check trending topics, search twitter"
	},
	'!todo': {
		//doing this NoSQL because yes.
		process: function(message, argument) {

			var messageFunction = function(msg){
				bot.sendMessage(message.channel, msg);
			}

			var method = getMethod(argument);

			if (method === "add"){
				var taskToAdd = getParameter(argument);
				todo.add(taskToAdd, message, messageFunction);
			}  else if (method === "remove"){
				var ids = getParameter(argument);
				todo.remove(ids, message, messageFunction);
			}  else if (method === "complete"){
				var id = getParameter(argument);
				todo.complete(id, message, messageFunction);
				// complete tasks
			}  else if (method === "export") {
				todo.exportList(message);
			}  else{
				todo.showTasks(message, messageFunction);
			}
		},
		usage: "[add <string>] [remove <id>] [complete <id>]",
		description: "Interact with the bot's todo lists."
	},
	'!ping': {
		process: function(message, argument){
			bot.sendMessage(message.channel, "Eat a banana, " + message.author.name);
			// console.log("Ping from " + message.author + " aka " + message.author.username);
			// console.log(message.server.memberMap)
			console.log(message.author.id);
			console.log(message.server.memberMap[message.author.id].nick);
		},
		description: "dumps info on the user to the console of the server."
	},
	'!tableflip': {
		process: function(message,argument) {
			bot.sendMessage(message.channel, "(╯°□°）╯︵ ┻━┻");
		},
		description: "Flip a table out of frustration."
	},
	'!pull': {
		process: function(message, argument){
			if (checkRole(message.author, message.server, 'developer')){
				gitHelper.pull(function(msg){
					bot.sendMessage(message.channel, msg);
				})
			}else{
				bot.sendMessage(message.channel, "You don't have enough badges to train me!");
			}
		},
		description: "Pulls the bot's code from github on to the server. You must have the role 'developer' to use this functionality."
	},
	'!help': {
		process: function(message, argument) {
			bot.sendMessage(message.author, "Available Commands: ", function() {
				for (var cmd in commands) {
					var info = cmd;
					var usage = commands[cmd].usage;
					if (usage) {
						info += " " + usage;
					}
					var description = commands[cmd].description;
					if(description){
						info += "\n\t" + description;
					}
					bot.sendMessage(message.author,info);
				}
			})
		},
		description: "PM's users a list of commands and invocation"
	},
	'!roll': {
		process: function(message, argument) {
			decider.rollDice(argument, function(result){
				bot.sendMessage(message.channel, result)
			})
		},
		usage: "<d20 syntax>",
		description: "Roll dice using d20 syntax"
	},
	'!kill': {
		process: function(message, argument) {
			if (checkRole(message.author, message.server, 'developer') || checkRole(message.author, message.server, 'Admin')) {
				console.log("Being shut down by " + message.author.username);
				bot.sendMessage(message.channel, "Beep boop, powering down.").then(function() {
					process.exit();
				});
			}  else {
				bot.sendMessage(message.channel, "You don't have enough badges to train me!");
			}
		},
		description: "This kills the robot. Must have proper privileges to execute."
	},
	'!task': {
		process: function(message,argument) {commands["!todo"].process(message,argument)}
	},
	'!eval': {
		process: function(message,argument){
			if (checkRole(message.author,message.server,"developer")) {
				eval(argument);
			}
		},
		usage: "!eval <raw code>",
		description: "Interact with the bot at the lowest level. Be careful or things will break."
	}
}


function output(error, token) {
    if (error) {
        console.log('There was an error logging in: ' + error);
        return;
    } else {
        console.log('Logged in. Token: ' + token);
    }
}

bot.loginWithToken(discord_auth.token, output);

bot.on('message', function(message){

	lastSeen.learn(message);

	if (message.content.toLowerCase().indexOf("eat a banana") != -1) {
		bot.sendMessage(message.channel,":banana:");
	}

	if (message.content.toLowerCase().indexOf("lenny") != -1) {
		bot.sendMessage(message.channel, "( ͡° ͜ʖ ͡°)")
	}
	//if bot is mentioned
	if (message.isMentioned(bot.user) || process.argv.indexOf("-l") != -1 && message.content.substring(0,1)=="!" || process.argv.indexOf("-local") != -1 && message.content.substring(0,1)=="!") {
		//Trim the mention from the message and any whitespace
		var command = message.content.substring(message.content.indexOf("!"),message.content.length).trim();
		if (command.substring(0,1) === "!") {
			var to_execute = command.split(' ')[0];
			var argument = command.substring(command.indexOf(' ')+1, command.length);
			if (commands[to_execute]) {
				commands[to_execute].process(message, argument)
			}  else {
				bot.sendMessage(message.channel, "Unknown Command :(");
			}
		}
	}
})

http.createServer().listen(port, function(){
	console.log("Listening on port: " + port);
})
