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

var knowledge = require("./responses.json");
var hobbyknowledge = require("./hobbyknowledge.json");
var fs = require('fs');

var Botkit = require('botkit');
var debug = require('debug')('botkit:main');

const rasa = require('./src/middleware-rasa')({
  rasa_uri: 'http://localhost:5000',
  rasa_project: 'default'
})

// Toggle modes of bot behavior:
// 1: grumpy 0: normal
var mood = 1;
// 1: on 0: off
var learningmode = 1;

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
  //console.log('Printing user name:');
  //console.log(message.user);

  /* search for your friend in the long list of friendz */
  var friend_content = [];
  var i;
  var friendind = 0;
  var thename = 'no name'
  for (i = 0; i < Object.keys(friendlist).length; ++i)
  {
    if (Object.keys(friendlist)[i] == message.user)
    {
      friend_content = Object.values(friendlist)[i];
      /*console.log(knowledge.chatbot_brain.responses.getByIndex(i))*/
      console.log('Found the friend list entry:');
      console.log(friend_content);
      friendind = 1;
    };
  };
  if (friendind == 0)
  {first_name
      console.log('I dont know this friend, adding to friend list');
      friendlist[message.user] = {};
      friendlist[message.user].username = 'no name';
      friendlist[message.user].friendlevel = 0;
      friendlist[message.user].datemet = today;
      console.log(friendlist);
      friend_content = friendlist[message.user];
  };
// If no name in database, find out name!
  if (friendlist[message.user].username == 'no name')
  {
    bot.createConversation(message, function(err, convo) 
    {
      // create a path for when a user says YES
      convo.addMessage({text: 'Okay!',action: 'completed',},'yes_thread');

      // create a path for when a user says NO
      convo.addMessage({text: 'Oh...',action: 'default',},'no_thread');

      // create a path where neither option was matched
      // this message has an action field, which directs botkit to go back to the `default` thread after sending this message.
      convo.addMessage({text: 'Cool!!!',action: 'confirm',},'nameresponse');
      convo.addMessage({text: 'I dont think I understand!!!',action: 'confirm',},'bad_response');

      // Create a yes/no question in the default thread...
      convo.addQuestion('Hey, what\'s your name!?', [
      {
        default: true,
        callback: function(response, convo) {
          convo.gotoThread('nameresponse');
          console.log(convo.extractResponses());
          thename = convo.extractResponse('Hey, what\'s your name!?');
        },
      }
      ],{},'default');

      convo.addQuestion('So you want to go by this name ?', [
      {
        pattern: bot.utterances.yes,
        callback: function(response, convo) {
            convo.gotoThread('yes_thread');
            friendlist[message.user].username = thename;

            // save friend list
            friendlist_export = JSON.stringify(friendlist);
            fs.writeFile("./friends.json", friendlist_export, function(err)
            {
	      if (err) throw err;
	      console.log('Friends Saved!');
            });
        },
      },
      {
        pattern: bot.utterances.no,
        callback: function(response, convo) {
            convo.gotoThread('no_thread');
        },
      },
      {
        default: true,
        callback: function(response, convo) {
            convo.gotoThread('bad_response');
        },
      }
      ],{},'confirm');

      convo.activate();
    });
  };

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
  //console.log("print the entity value");  
  //console.log(message.entities[0].value);

  // say the thing based on your friend level
  var randnum = Math.floor(Math.random() * 10);
  console.log(randnum);
  console.log(friend_content.friendlevel);
  if (message.intent.confidence < .75)
  {
    //bot.reply(message, convo_content[0].misunderstand);
    bot.replyWithTyping(message, convo_content[0].misunderstand);
  }
  else if (friend_content.friendlevel < 1)
  {
    //bot.reply(message, convo_content[0].lvl1);
    bot.replyWithTyping(message, convo_content[0].lvl1);
  }
  else if (friend_content.friendlevel >= 1 && friend_content.friendlevel < 4)
  {
    // bot.reply(message, convo_content[0].lvl2);
    console.log(friend_content.username);
    if(randnum == 0)
    {
        bot.replyWithTyping(message, friend_content.username + " " + convo_content[0].lvl2);
    }
    else bot.replyWithTyping(message, convo_content[0].lvl2);
  }
  else if (friend_content.friendlevel >= 4 && friend_content.friendlevel < 8)
  {
    if(randnum == 1)
    {
        bot.replyWithTyping(message, friend_content.username + " " + convo_content[0].lvl3);
    }
    else bot.replyWithTyping(message, convo_content[0].lvl3);
  }
  else if (friend_content.friendlevel >= 8 && friend_content.friendlevel < 12)
  {
    if(randnum == 1)
    {
        bot.replyWithTyping(message, friend_content.username + " " + convo_content[0].lvl4);
    }
    else bot.replyWithTyping(message, convo_content[0].lvl4);
  }
  else if (friend_content.friendlevel >= 12 && friend_content.friendlevel < 16)
  {
    if(randnum <= 1)
    {
        bot.replyWithTyping(message, friend_content.username + " " + convo_content[0].lvl5);
    }
    else bot.replyWithTyping(message, convo_content[0].lvl5);
  }
  else if (friend_content.friendlevel >= 16 && friend_content.friendlevel < 20)
  {
    if(randnum <= 2)
    {
        bot.replyWithTyping(message, friend_content.username + " " + convo_content[0].lvl6);
    }
    else bot.replyWithTyping(message, convo_content[0].lvl6);
  }

  // increment friend points
  friendlist[message.user].friendlevel += convo_content[0].friendpoints;

  // save friend list
  friendlist_export = JSON.stringify(friendlist);
  fs.writeFile("./friends.json", friendlist_export, function(err)
  {
	if (err) throw err;
	  console.log('Friends Saved!');
  });

  // save log
  message_export = JSON.stringify(message);
  fs.appendFile("./logofinteractions.json", message_export, function(err)
  {
	if (err) throw err;
	  console.log('Interaction Saved!');
  });
})

/*
  // HOBBY STUFF FOR ANOTHER DAY
  var s_hobbyknowledge = [];
  if (message.entities != null)
  {
    console.log(message.entities[0].value);
    console.log('topic not null');
    for (i = 0; i < Object.keys(hobbyknowledge).length; ++i)
    {
      if (Object.keys(hobbyknowledge)[i] == message.entities[0].value)
      {
        s_hobbyknowledge = Object.values(hobbyknowledge)[i];
        console.log('Found the topic being talked about');
        console.log(s_hobbyknowledge);
        bot.reply(message, s_hobbyknowledge.knowledge);
      }
    }
    var randnum = Math.floor(Math.random() * 10);
    //console.log('Random num is');
    //console.log(randnum);
    // it doesnt know about it, and a .5 chance.... FIX PROBABILITY
    if ((s_hobbyknowledge == []) && (randnum <11))
    {
      console.log('no clue about this hobby / topic not null');
      bot.reply(message, 'tell me about that!');
      // enter a conversation about the subject
      
      bot.createConversation(message, function(err, convo) {
           // create a path for when a user says YES
            convo.addMessage({
                    text: 'That sounds awesome!',
                    action: 'completed',
            },'yes_thread');
            // create a path where neither option was matched
            // this message has an action field, which directs botkit to go back to the `default` thread after sending this message.
            convo.addMessage({
                text: 'Sorry I did not understand.',
                action: 'default',
            },'bad_response');

            // Ask about hobby
            //&& message.entities[0].value
            convo.addQuestion('Tell me about it', [
                {
                    pattern: 'yes',
                    callback: function(response, convo) {
                        convo.gotoThread('yes_thread');
                    },
                },
                {
                    default: true,
                    callback: function(response, convo) {
                        convo.gotoThread('bad_response');
                    },
                }
            ],{},'default');

            convo.activate();
      });
      

    };
  };
*/
  // loop through the brain to find the right thing to say



