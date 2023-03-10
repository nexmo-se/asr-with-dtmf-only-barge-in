'use strict'

//-------------

require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser')
const app = express();
const expressWs = require('express-ws')(app);
const Vonage = require('@vonage/server-sdk');
const { Readable } = require('stream');

// ------------------

// HTTP client
const webHookRequest = require('request');

const reqHeaders = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
};

 //---- CORS policy - Update this section as needed ----

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Methods", "OPTIONS,GET,POST,PUT,DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
  next();
});

//-------

app.use(bodyParser.json());

//-------

let router = express.Router();
router.get('/', express.static('app'));
app.use('/app',router);

//------

const servicePhoneNumber = process.env.SERVICE_PHONE_NUMBER;
const forwardingPhoneNumber = process.env.FORWARDING_NUMBER;

//-------------

const vonage = new Vonage({
  apiKey: process.env.API_KEY,
  apiSecret: process.env.API_SECRET,
  applicationId: process.env.APP_ID,
  privateKey: './.private.key'
});

//-------------

// Voice API ASR parameters
// See https://developer.nexmo.com/voice/voice-api/ncco-reference#speech-recognition-settings

const endOnSilence = 1.0; // in seconds, adjust as needed for your user's voice interaction experience
const startTimeout = 10;  // in seconds, adjust as needed for your user's voice interaction experience

// Voice API DTMF detection settings
// See https://developer.vonage.com/en/voice/voice-api/ncco-reference#dtmf-input-settings

const dtmfTimeOut = 3; // in seconds, adjust as needed for your user's interaction experience

// Max number of cycles for voice prompts without DTMF or without correct ASR intent reply
const maxPromptLoops = 2;
const maxNoAsrDetectedLoops = 3;

//-------------

// Language locale settings

// Vonage Voice API supports multiple language locales for ASR (Automatic Speech Recognition) and TTS (Text To Speech) as listed in
// https://developer.vonage.com/voice/voice-api/guides/asr#language
// and
// https://developer.vonage.com/voice/voice-api/guides/text-to-speech#supported-languages

// We use both ASR and TTS capabilities of Vonage Voice API for this application

// In this example, uncomment the set of parameters below for the language you would like to try, and comment the other set of parameters

const languageCode = process.env.LANGUAGE_CODE || 'en-US';
const ttsStyle = process.env.TTS_STYLE || 11; // see https://developer.nexmo.com/voice/voice-api/guides/text-to-speech
const greetingText = process.env.GREETING_TEXT || "Hello";
const voicePrompt1 = "For branch opening hours, press 1 or say opening. \
For loan applications, press 2 or say loan. \
To speak to a teller, press 0 or say teller.";
const voicePrompt2 = 'For option 1, press 1 or say "yeppie !". For option 2, press 2 or say "yay !". For option 3, press 3 or say "go go!". For option 4, press 4 or say "happy hour!".';
const voicePromptGoodBye = 'It was a great pleasure serving you today. We look forward to talking to you again. Good bye!'
const voicePromptTooMuch = 'Since you have not yet decided what you want in your life. Please call us again when you do. Good bye for now!'

//-----------

console.log("Service phone number:", servicePhoneNumber);

//==========================================================

function reqCallback(error, response, body) {
    if (body != "Ok") {  
      console.log("HTTP request call status:", body);
    };  
}
 
//--- just testing making calls from a local request
app.get('/makecall', (req, res) => {

  res.status(200).send('Ok');

  const hostName = `${req.hostname}`;

  let callInfo;
  let reqOptions;

  callInfo = {
    'type': 'phone',
    'number': '12995550101'  // replace with the actual phone number to call for tests
  };

  console.log("callInfo:", JSON.stringify(callInfo));

  reqOptions = {
    url: 'https://' + hostName + '/placecall',
    method: 'POST',
    headers: reqHeaders,
    body: JSON.stringify(callInfo)
  };

  console.log("webHookRequest 1");

  webHookRequest(reqOptions, reqCallback);

});

//-----------------

app.post('/placecall', (req, res) => {

  res.status(200).send('Ok');

  const hostName = `${req.hostname}`;
  const numberToCall = req.body.number;

  vonage.calls.create({
    to: [{
      type: 'phone',
      number: numberToCall
    }],
    from: {
     type: 'phone',
     number: servicePhoneNumber
    },
    answer_url: ['https://' + hostName + '/answer'],
    answer_method: 'GET',
    event_url: ['https://' + hostName + '/event'],
    event_method: 'POST'
    }, (err, res) => {
    if(err) {
      console.error(">>> outgoing call error:", err);
      console.error(err.body);
    } else {
      console.log(">>> outgoing call status:", res);
    }
  });

});

//-------

app.get('/answer', (req, res) => {

    const uuid = req.query.uuid;
    const hostName = `${req.hostname}`;

    app.set('prompt_cycle_' + uuid, 1); // this is the 1st cycle of a given voice prompt for this specific call
    app.set('asr_cycle_' + uuid, 0); // number of ASR loop cycles for the same voice prompt


    console.log('\n/answer webhook:');
    console.log('conversation_uuid:', req.query.conversation_uuid);
    console.log('uuid:', uuid);
    
    const nccoResponse = [
        {
          "action": "talk",
          "language": languageCode,
          "text": voicePrompt1,
          "loop": 1,
          "bargeIn": true,
          "style": ttsStyle
        },
        {
          "action": "input",  // see https://developer.vonage.com/en/voice/voice-api/ncco-reference#dtmf-input-settings
          "eventUrl": ["https://" + hostName + "/dtmf?prompt=voicePrompt1&call_uuid=" + uuid],
          "eventMethod": "POST",
          "type": ["dtmf"],  
          "dtmf":
            {
            "maxDigits": 1,
            "timeOut": 1
            }
        },
        {
          "action": "conversation",
          "name": "conf_" + uuid
        }
    ];

  res.status(200).json(nccoResponse);

});

//-------

app.post('/event', (req, res) => {

  console.log("\n/event webhook:");
  console.log(req.body);

  res.status(200).send('Ok');

});

//---------

app.post('/asr', (req, res) => {

  console.log("\n/asr webhook:");
  console.log(req.body);

  const hostName = `${req.hostname}`;

  const uuid = req.body.uuid;

  let nccoResponse;
  let promptLoops;

  let transcript = "";
  let lastPrompt = "";

  let nextVoicePrompt = req.query.prompt;

  console.log('nextVoicePrompt:', nextVoicePrompt);


  let hangUpThisCall = false;

  let anotherAsrOnlyLoop = false;
  let asrLoopCounter = 1;

  //----

  if (req.body.speech.hasOwnProperty('results')) {

    if(req.body.speech.results == undefined || req.body.speech.results.length < 1) {

      if (req.body.speech.hasOwnProperty('timeout_reason')) {
        console.log('>>> ASR 1 timeout reason:', req.body.speech.timeout_reason);
      }

      promptLoops = app.get('prompt_cycle_' + uuid) + 1; // increase voice prompt loop play count
      app.set('prompt_cycle_' + uuid, promptLoops);  // store new count

      if (promptLoops > maxPromptLoops) {
        app.set('prompt_cycle_' + uuid, null);  // counter for this call is no longer needed
        lastPrompt = voicePromptTooMuch;
        hangUpThisCall = true; // call to be terminated      
      }; 
    
      console.log(">>> No speech detected on call uuid ", uuid);

      anotherAsrOnlyLoop = true;

    } 
    else {

      transcript = req.body.speech.results[0].text;
      console.log(">>> Speech transcript on call " + uuid + ":", transcript);

      app.set('asr_cycle_' + uuid, 0); // reset the number of ASR loop cycles for the next new voice prompt

      // Normally there is further processing of the ASR transcript result here to decide
      // what is the next voice prompt to be played for the next input action.
      // For demo purpose, we hard code only one possible next "input" action voice prompt, e.g. voicePrompt2

      if (req.query.prompt === "voicePrompt2") { // did we get ASR of the last voice prompt?

        console.log(">>> Got ASR transcript for voicePrompt2!");

        lastPrompt = voicePromptGoodBye;
        hangUpThisCall = true; // call to be terminated  

      } else {    // we just got the ASR response for voicePrompt2

        nextVoicePrompt = "voicePrompt2";

      }  

    }  

  } 
  else {

    if (req.body.speech.hasOwnProperty('timeout_reason')) {
      console.log('>>> ASR 1 timeout reason:', req.body.speech.timeout_reason);
    }      

    if (req.body.speech.hasOwnProperty('error')) {
      console.log('>>> ASR 1 error:', req.body.speech.error);
    }

    console.log(">>> No speech detected on call uuid ", uuid);

    if (promptLoops > maxPromptLoops) {
      
      app.set('prompt_cycle_' + uuid, null);  // counter for this call is no longer needed
      lastPrompt = voicePromptTooMuch;
      hangUpThisCall = true; // call to be terminated      
    
    }

    anotherAsrOnlyLoop = true;
  
  };

  if (hangUpThisCall) {

      res.status(200).send('Ok');

      let yourTranscript = "";

      if (transcript !== "") {
        yourTranscript = "You said " + transcript + ". ";
      };

      // play TTS
      vonage.calls.talk.start(uuid,  
        {
        text: yourTranscript + lastPrompt,
        language: languageCode, 
        style: ttsStyle
        }, (err, res) => {
          if (err) { console.error('Talk ', uuid, 'error: ', err, err.body.invalid_parameters); }
          else {
           console.log('Talk ', uuid, 'status: ', res);
        }
      });

      // hang up the call


      setTimeout(() => {
        vonage.calls.update(uuid, {action: 'hangup'}, (err, res) => {
            if (err) { console.error('>>> Call ' + uuid + ' tear down error', err); }
            else {console.log ('>>> Call ' + uuid + ' terminated')};
        });
      }, 10000);    // give time for the last TTS announcement to play before hanging up


  } else {

    const asrCycles = app.get('asr_cycle_' + uuid) 

    if ( anotherAsrOnlyLoop && (asrCycles < maxNoAsrDetectedLoops) ) {

      app.set('asr_cycle_' + uuid, asrCycles + 1); // number of ASR loop cycles for the same voice prompt

      nccoResponse = [
        {
          "action": "input",  // see https://developer.nexmo.com/voice/voice-api/ncco-reference#speech-recognition-settings
          "eventUrl": ["https://" + hostName + "/asr?prompt=" + req.query.prompt],
          "eventMethod": "POST",
          "type": ["speech"],  
          "speech":
            {
            "uuid": [uuid], 
            "endOnSilence": endOnSilence, 
            "language": languageCode,
            "startTimeout": startTimeout
            } 
        },
        {
          "action": "conversation",
          "name": "conf_" + uuid
        }
      ];

    } else {

      nccoResponse = [
          {
            "action": "talk",
            "language": languageCode,
            "text": "You said " + transcript + ". " + eval(nextVoicePrompt),
            "loop": 1,
            "bargeIn": true,
            "style": ttsStyle
          },
          {
            "action": "input",  // see https://developer.vonage.com/en/voice/voice-api/ncco-reference#dtmf-input-settings
            "eventUrl": ["https://" + hostName + "/dtmf?prompt=" + nextVoicePrompt + "&call_uuid=" + uuid],
            "eventMethod": "POST",
            "type": ["dtmf"],  
            "dtmf":
              {
              "maxDigits": 1,
              "timeOut": 1
              }
          },
          {
            "action": "conversation",
            "name": "conf_" + uuid
          }
      ];

    }

    console.log('>>> nccoResponse:', nccoResponse);

    res.json(nccoResponse);

  };

});

//---------

app.post('/dtmf', (req, res) => {

  console.log("\n/dtmf webhook:");
  console.log(req.query);
  console.log(req.body);

  const hostName = `${req.hostname}`;
  const uuid = req.query.call_uuid;


  let dtmf = req.body.dtmf.digits;
  console.log('pressed DTMF:', dtmf);

  let nccoResponse;

  if (dtmf === "") {

    const asrCycles = app.get('asr_cycle_' + uuid);
    app.set('asr_cycle_' + uuid, asrCycles + 1);  // increase the number of ASR loop for same voice prompt

    nccoResponse = [
      {
        "action": "input",  // see https://developer.nexmo.com/voice/voice-api/ncco-reference#speech-recognition-settings
        "eventUrl": ["https://" + hostName + "/asr?prompt=" + req.query.prompt],
        "eventMethod": "POST",
        "type": ["speech"],  
        "speech":
          {
          "uuid": [uuid], 
          "endOnSilence": endOnSilence, 
          "language": languageCode,
          "startTimeout": startTimeout
          } 
      },
      {
        "action": "conversation",
        "name": "conf_" + uuid
      }
    ];

    res.status(200).json(nccoResponse);

  } else {  // got a DTMF

    app.set('prompt_cycle_' + uuid, 1); // this is the 1st cycle of a given voice prompt for this specific call

    if (req.query.prompt === 'voicePrompt1') {

      nccoResponse = [
          {
            "action": "talk",
            "language": languageCode,
            "text": "You pressed the " + dtmf + " key. " + voicePrompt2,
            "bargeIn": true,
            "style": ttsStyle
          },
          {
            "action": "input",  // see https://developer.vonage.com/en/voice/voice-api/ncco-reference#dtmf-input-settings
            "eventUrl": ["https://" + hostName + "/dtmf?prompt=voicePrompt2&call_uuid=" + uuid],
            "eventMethod": "POST",
            "type": ["dtmf"],  
            "dtmf":
              {
              "maxDigits": 1,
              "timeOut": dtmfTimeOut
              }
          },
          {
            "action": "conversation",
            "name": "conf_" + uuid
          }
      ];

      res.status(200).json(nccoResponse);
    
    } else {  // last voice prompt has been played

    res.status(200).send('Ok');

      // play TTS
      vonage.calls.talk.start(uuid,  
        {
        text: "You pressed the " + dtmf + " key. " + voicePromptGoodBye,
        language: languageCode, 
        style: ttsStyle
        }, (err, res) => {
          if (err) { console.error('Talk ', uuid, 'error: ', err, err.body.invalid_parameters); }
          else {
           console.log('Talk ', uuid, 'status: ', res);
        }
      });

      // hang up the call


      setTimeout(() => {
        vonage.calls.update(uuid, {action: 'hangup'}, (err, res) => {
            if (err) { console.error('>>> Call ' + uuid + ' tear down error', err); }
            else {console.log ('>>> Call ' + uuid + ' terminated')};
        });
      }, 10000);    // give time for the last TTS announcement to play before hanging up
    }
  }  

});

//=========================================

const port = process.env.PORT || 8000;

app.listen(port, () => console.log(`Voice API application listening on port ${port}!`));

//------------
