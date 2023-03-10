# Vonage API - Input action - Barge-in only with DTMF, no barge-in with voice

Notice: All following text need to be reviewed for accuracy

## About this application

This application makes use of Vonage Voice API to answer incoming or place voice calls, it:</br>
- Uses Vonage Voice API to do ASR (Automatic Speech Recognition) on caller's speech or detect DTMF key press</br>
- You may interrupt the current voice prompt (aka barge-in) being played with a DTMF key press. You need to listen to listen to the whole voice prompt before being able to reply with voice, you may not barge-in with speech but only with key press from your phone.</br>

Once this application is running, you call in to the **`phone number linked`** to your application (as explained below) to interact via voice with your chatbot.</br>

### Local deployment using ngrok

If you plan to test using `Local deployment with ngrok` (Internet tunneling service) for this Voice API application, follow these instructions to set up ngrok:

- [Install ngrok](https://ngrok.com/download),
- Make sure you are using the latest version of ngrok and not using a previously installed version of ngrok,
- Sign up for a free [ngrok account](https://dashboard.ngrok.com/signup),
- Verify your email address from the email sent by ngrok,
- Retrieve [your Authoken](https://dashboard.ngrok.com/get-started/your-authtoken), 
- Run the command `ngrok config add-authtoken <your-authtoken>`
- Set up a tunnel
	- Run `ngrok config edit`
		- For a free ngrok account, add following lines to the ngrok configuration file (under authoken line):</br>
		<pre><code>	
		tunnels:
			eight:</br>
				proto: http</br>
				addr: 8000</br>
		</code></pre>
		- For a [paid ngrok account](https://dashboard.ngrok.com/billing/subscription), you may set ngrok hostnames that never change on each ngrok new launch, add following lines to the ngrok configuration file (under authoken line) - set hostnames to actual desired values:</br>
		<pre><code>	
		tunnels:
			eight:</br>
				proto: http</br>
				addr: 8000</br>
				hostname: setanamehere8.ngrok.io*</br>
		</code></pre>			
		Note: The Voice API application (this repository) will be running on local port 8000, the sample simple chatbot will be running on local port 6000
- Start both ngrok tunnels
	- Run `ngrok start six eight`</br>
	- You will see lines like
		....</br>
		*Web Interface                 http://127.0.0.1:4040                                     
		Forwarding                   https://xxxxxxx.ngrok.io -> http://localhost:6000*</br> 
	- Make note of *https://yyyyyyy.ngrok.io* (with the leading https://), the one associated to local port 8000, as it will be needed in the next steps below.</br>	


### Non local deployment

If you are using hosted servers, for example Heroku, your own servers, or some other cloud provider,
you will need the public hostnames and if necessary public ports of the servers that
run the Voice API application (this repository),</br>
and the one that run the simple chatbot,</br>
e.g.</br>
	*`myappname.herokuapp.com`, `myserver1.mycompany.com:32000`*</br>

  (no `port` is necessary with heroku as public hostname)

For Heroku deployment, see more details in the next section **Command Line Heroku deployment**.  

## Set up your Vonage Voice API application credentials and phone number

[Log in to your](https://ui.idp.vonage.com/ui/auth/login) or [sign up for a](https://ui.idp.vonage.com/ui/auth/registration) Vonage API account.

Go to [Your applications](https://dashboard.nexmo.com/applications), access an existing application or [+ Create a new application](https://dashboard.nexmo.com/applications/new).

Under **Capabilities** section (click on [Edit] if you do not see this section):

Enable Voice
- Under Answer URL, leave HTTP GET, and enter https://\<host\>:\<port\>/answer (replace \<host\> and \<port\> with the public host name and if necessary public port of the server where this sample application is running), e.g.</br>
*https://yyyyyyyy.ngrok.io/answer*</br>
or
*https://myappname.herokuapp.com/answer*</br>
or
*https://myserver.mycompany.com:40000/answer*</br>
- Under Event URL, **select** **_HTTP POST_**, and enter https://\<host\>:\<port\>/event (replace \<host\> and \<port\> with the public host name and if necessary public port of the server where this sample application is running), e.g.</br>
*https://yyyyyyyy.ngrok.io/event*</br>
or
*https://myappname.herokuapp.com/event*</br>

- Click on [Generate public and private key] if you did not yet create or want new ones, then save as **.private.key** file (note the leading dot in the file name) in this application folder.</br>
**IMPORTANT**: Do not forget to click on [Save changes] at the bottom of the screen if you have created a new key set.</br>
- Link a phone number to this application if none has been linked to the application.

Please take note of your **application ID** and the **linked phone number** (as they are needed in the very next section.)

For the next steps, you will need:</br>
- Your [Vonage API key](https://dashboard.nexmo.com/settings) (as **`API_KEY`**)</br>
- Your [Vonage API secret](https://dashboard.nexmo.com/settings), not signature secret, (as **`API_SECRET`**)</br>
- Your `application ID` (as **`APP_ID`**),</br>
- The **`phone number linked`** to your application (as **`SERVICE_NUMBER`**), your phone will **call that number**,</br>
- The Simple Text-Only chatbot server public hostname and port (as **`BOT_SERVER`**), the argument has no http:// nor https:// prefix, no trailing /, and no sub-path, e.g.</br>
*xxxxxxx.ngrok.io*</br>
or
*mysimplebotname.herokuapp.com*</br>
or
*myserver1.mycompany.com:32000*</br>

## Overview on how this sample Voice API application works

- This application may receive incoming calls to the **`phone number linked`**, or you may initiate outgoing calls by opening in a web browser the URL \<this-server-hostname\>/makecall (update the number to call in _callInfo_ object in the source file asr-with-dtmf-only-barge-in.js).
</br>


## Running this sample Voice API application

You may select one of the following 2 types of deployments.

### Local deployment

To run your own instance of this sample application locally, you'll need an up-to-date version of Node.js (we tested with version 16.15.1).

Download this sample application code to a local folder, then go to that folder.

Copy the `env.example` file over to a new file called `.env` (with leading dot):
```bash
cp env.example .env
```

Edit `.env` file, and set the five parameter values:</br>
API_KEY=</br>
API_SECRET=</br>
APP_ID=</br>
SERVICE_NUMBER=</br>


Install dependencies once:
```bash
npm install
```

Make sure ngrok has been already started with both tunnels as explained in previous section.

Launch the application:
```bash
node voice-on-text-bot-app-with-simple-bot
```
See also the next section **Testing voice integration with a sample text-only simple chatbot**

### Command Line Heroku deployment

You must first have deployed your application locally, as explained in previous section, and verified it is working.

Install [git](https://git-scm.com/downloads).

Install [Heroku command line](https://devcenter.heroku.com/categories/command-line) and login to your Heroku account.

If you do not yet have a local git repository, create one:</br>
```bash
git init
git add .
git commit -am "initial"
```

Start by creating this application on Heroku from the command line using the Heroku CLI:
*Note: In following command, replace "myappname" with a unique name on the whole Heroku platform*

```bash
heroku create myappname
```

On your Heroku dashboard where your application page is shown, click on `Settings` button,
add the following `Config Vars` and set them with their respective values:</br>
API_KEY</br>
API_SECRET</br>
APP_ID</br>
SERVICE_NUMBER</br>
PRIVATE_KEY_FILE with the value **./.private.key**</br>

Now, deploy the application:


```bash
git push heroku master
```

On your Heroku dashboard where your application page is shown, click on `Open App` button, that hostname is the one to be used under your corresponding [Vonage Voice API application Capabilities](https://dashboard.nexmo.com/applications) (click on your application, then [Edit]).</br>

For example, the respective links would be (replace *myappname* with actual value):</br>
https://myappname.herokuapp.com/answer</br>
https://myappname.herokuapp.com/event</br>

See more details in above section **Set up your Vonage Voice API application credentials and phone number**.