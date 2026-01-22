# Share Opinions

Opinions is a simple web application for sharing philosophical, political and personal opinions. It may be used as an ID-card for debates, as a quick way of describing your ideas or as a discovery compass for people. Technically, it first stores your answers in `localStorage`, then you can register using a Google account and publicly share your profile. A random, anonymous username will be generated for your account. To change it to a custom one, [contact me](https://matheo.tripnaux.com/explore/networks) or [raise an issue](https://github.com/mtripnaux/opinions/issues/new).

## Usage

You can answer the questions locally and compare to others if you have their personal profile link. To share your own, you will need to register using a Google account, then you will simply have to copy your profile url (usually `[root]/<locale>/<your_id>`) and share it online! Notice that two languages are available: English and French. You can switch by changing the `<locale>` part of the url, and it will stay as long as you stay on the website. By default, the locale value is defined by your browser's settings.

## Contribute

We are open to additional questions, new translations and feature suggestions. Please [open an issue](https://github.com/mtripnaux/opinions/issues/new) on this repo or [contact me](https://matheo.tripnaux.com/explore/networks) to do so.

## Run your own

You simply need to clone the repo, `npm install` the dependencies and create a `.env` file with these keys from your [Firebase] project:

```bash
VITE_FIREBASE_API_KEY=<YOUR_VALUE_HERE>
VITE_FIREBASE_AUTH_DOMAIN=<YOUR_VALUE_HERE>
VITE_FIREBASE_PROJECT_ID=<YOUR_VALUE_HERE>
VITE_FIREBASE_STORAGE_BUCKET=<YOUR_VALUE_HERE>
VITE_FIREBASE_MESSAGING_SENDER_ID=<YOUR_VALUE_HERE>
VITE_FIREBASE_APP_ID=<YOUR_VALUE_HERE>
VITE_FIREBASE_MEASUREMENT_ID=<YOUR_VALUE_HERE>
```

## Licence

This work by [Matheo Tripnaux](https://matheo.tripnaux.com) is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
