# 2 warcraft 2 radio

This is a super simple app using [Express](https://expressjs.com) to power a streaming "radio" station, similar to [Icecast](https://icecast.org).

## usage

Upload your tracks into the `static/tracks` folder (thanks to [Thanatos](http://www.thanatosrealms.com/war2/alliance-sounds) for the Warcraft 2 sounds) and start the app (`npm start` if you're in Termal or similar). If you're running locally, that'll start up a server at `localhost:3000` where you'll hear the tracks shuffled continuously (and so will anyone else who has the app open!).

Note that for right now, only MP3s are supported. This is probably something I'll fix if this becomes more than a joke.
