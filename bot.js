/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
               __         __                             __ 
.----.-----.--|  | .----.|  |--.---.-.-----.-----.-----.|  |
|   _|  -__|  _  | |  __||     |  _  |     |     |  -__||  |
|__| |_____|_____| |____||__|__|___._|__|__|__|__|_____||__|
                                                            
 __           __   
|  |--.-----.|  |_ 
|  _  |  _  ||   _|
|_____|_____||____|
                   
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
var env = require('node-env-file');
env(__dirname + '/.env');


if (!process.env.page_token) {
    console.log('Error: Specify a Facebook page_token in environment.');
    process.exit(1);
}

if (!process.env.verify_token) {
    console.log('Error: Specify a Facebook verify_token in environment.');
    process.exit(1);
}

/* get date */
var today = new Date();
var dd = today.getDate();
var mm = today.getMonth()+1; //January is 0!
var yyyy = today.getFullYear();
if(dd<10) {
    dd = '0'+dd
} 
if(mm<10) {
    mm = '0'+mm
} 
today = mm + '/' + dd + '/' + yyyy;

var knowledge = require("./responses.json");
var fs = require('fs');

var Botkit = require('botkit');
var debug = require('debug')('botkit:main');

const rasa = require('./src/middleware-rasa')({
  rasa_uri: 'http://localhost:5000',
  rasa_project: 'default'
})

// Create the Botkit controller, which controls all instances of the bot.
var controller = Botkit.facebookbot({
    // debug: true,
    verify_token: process.env.verify_token,
    access_token: process.env.page_token,
    studio_token: process.env.studio_token,
    studio_command_uri: process.env.studio_command_uri,
    log: true,
    debug: true,
    validate_requests: false,
});

console.log(rasa)
controller.middleware.receive.use(rasa.receive)

// Set up an Express-powered webserver to expose oauth and webhook endpoints
var webserver = require(__dirname + '/components/express_webserver.js')(controller);

// Tell Facebook to start sending events to this application
require(__dirname + '/components/subscribe_events.js')(controller);

// Set up Facebook "thread settings" such as get started button, persistent menu
require(__dirname + '/components/thread_settings.js')(controller);


// Send an onboarding message when a user activates the bot
require(__dirname + '/components/onboarding.js')(controller);

// Load in some helpers that make running Botkit on Glitch.com better
require(__dirname + '/components/plugin_glitch.js')(controller);

// enable advanced botkit studio metrics
require('botkit-studio-metrics')(controller);

var normalizedPath = require("path").join(__dirname, "skills");
require("fs").readdirSync(normalizedPath).forEach(function(file) {
  require("./skills/" + file)(controller);
});


// This captures and evaluates any message sent to the bot as a DM
// or sent to the bot in the form "@bot message" and passes it to
// Botkit Studio to evaluate for trigger words and patterns.
// If a trigger is matched, the conversation will automatically fire!
// You can tie into the execution of the script using the functions
// controller.studio.before, controller.studio.after and controller.studio.validate

controller.hears(['greet'], 'direct_message,direct_mention,mention,message_received,facebook_postback', rasa.hears, function (bot, message) {
  var friendlist = require("./friends.json");
  //console.log(friendlist)
  console.log(message);
  console.log('Printing user name:');
  console.log(message.user);

  /* search for your friend in the long list of friendz */
  var friend_content = [];
  var i;
  for (i = 0; i < Object.keys(friendlist).length; ++i)
  {
    if (Object.keys(friendlist)[i] == message.user)
    {
      friend_content = Object.values(friendlist)[i];
      /*console.log(knowledge.chatbot_brain.responses.getByIndex(i))*/
      console.log('Found the friend list entry:');
      console.log(friend_content);
    }
    else
    {
      console.log('I dont know this friend, adding to friend list');
      friendlist[message.user] = {};
      friendlist[message.user].username = 'no name';
      friendlist[message.user].friendlevel = 0;
      friendlist[message.user].datemet = today;
      console.log(friendlist);
      friend_content = friendlist[message.user];
    }
  }


  /* loop through the brain to find the right thing to say*/
  var convo_content = [];
  var i;
  var obj;
  for (i = 0; i < Object.keys(knowledge.chatbot_brain.responses).length; ++i)
  {
    if (Object.keys(knowledge.chatbot_brain.responses)[i] == message.intent.name)
    {
      convo_content = Object.values(knowledge.chatbot_brain.responses)[i];
      console.log('Found it! Its:');
      console.log(convo_content);
    }
  }
  /* say the thing based on your friend level*/
  console.log(friend_content.friendlevel);
  if (message.intent.confidence < .75)
  {
    bot.reply(message, convo_content[0].misunderstand);
  }
  else if (friend_content.friendlevel < 1)
  {
    bot.reply(message, convo_content[0].lvl1);
  }
  else if (friend_content.friendlevel >= 1 && friend_content.friendlevel < 4)
  {
    bot.reply(message, convo_content[0].lvl2);
  }
  else if (friend_content.friendlevel >= 4 && friend_content.friendlevel < 8)
  {
    bot.reply(message, convo_content[0].lvl3);
  }
  else if (friend_content.friendlevel >= 8 && friend_content.friendlevel < 12)
  {
    bot.reply(message, convo_content[0].lvl4);
  }
  else if (friend_content.friendlevel >= 12 && friend_content.friendlevel < 16)
  {
    bot.reply(message, convo_content[0].lvl5);
  }
  else if (friend_content.friendlevel >= 16 && friend_content.friendlevel < 20)
  {
    bot.reply(message, convo_content[0].lvl6);
  }

  /* increment friend points*/
  friendlist[message.user].friendlevel += convo_content[0].friendpoints;

  /* save friend list */  
  friendlist_export = JSON.stringify(friendlist);
  fs.writeFile("./friends.json", friendlist_export, function(err)
  {
	if (err) throw err;
	  console.log('Friends Saved!');
  });

  /*save log*/
  message_export = JSON.stringify(message);
  fs.appendFile("./logofinteractions.json", message_export, function(err)
  {
	if (err) throw err;
	  console.log('Interaction Saved!');
  });
})   


/*
if (process.env.studio_token) {
    controller.on('message_received,facebook_postback', function(bot, message) {
        if (message.text) {
		bot.reply(message, 'I am ALIIIIIIIIIVE ');
	}
    });
}
*/

//            controller.studio.runTrigger(bot, message.text, message.user, message.channel, message).then(function(convo) {
//                if (!convo) {
//                    // no trigger was matched
//                    // If you want your bot to respond to every message,
//                    // define a 'fallback' script in Botkit Studio
//                    // and uncomment the line below.
//                    controller.studio.run(bot, 'fallback', message.user, message.channel, message);
//                } else {
//                    // set variables here that are needed for EVERY script
//                    // use controller.studio.before('script') to set variables specific to a script
//                    convo.setVar('current_time', new Date());
//                }
//            }).catch(function(err) {
//                if (err) {
//                    bot.reply(message, 'I experienced an error with a request to Botkit Studio: ' + err);
//                    debug('Botkit Studio: ', err);
//                }
//            });
/*        
else {
    console.log('~~~~~~~~~~');
    console.log('NOTE: Botkit Studio functionality has not been enabled');
    console.log('To enable, pass in a studio_token parameter with a token from https://studio.botkit.ai/');
}
*/
