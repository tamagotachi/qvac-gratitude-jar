# Gratitude Jar (QVAC)

An **on-device AI** gives you a fresh, warm gratitude prompt every day. Write your answer and add it to the jar, which keeps a **daily streak**. Tap the jar to **shake it** and reveal a random entry from your past, a nice way to revisit old moments of gratitude.

It runs **on your own computer** using [QVAC](https://github.com/tetherto/qvac), Tether's open-source AI SDK.
No API key, no cloud service, and what you type never leaves your machine.

![screenshot](screenshot.png)

## SDK version

`@qvac/sdk` **0.19.0** (declared in `package.json`)

Functions used: `loadModel` and `completion` (with structured output via `responseFormat`), with the `LLAMA_3_2_1B_INST_Q4_0` model.

## Install

You need [Node.js](https://nodejs.org) 22 or newer and some free disk space for the model.

```bash
git clone https://github.com/misaki-codex/qvac-gratitude-jar.git
cd qvac-gratitude-jar
npm install
```

## Run

```bash
npm start
```

Then open **http://localhost:3099** (the address, not the HTML file). The first start downloads the model.
While it loads, a handful of built-in prompts are used, and saving, the streak and shaking the jar all work fully.

## How it works

- `server.js` calls `completion` with a JSON schema that returns one prompt at a time, told not to repeat prompts you've already used.
- **The streak and jar are plain code**: the streak increases only when you save on a new day after saving the day before, and shaking the jar picks a random saved entry.
- Your entries, streak and prompt history are saved in your browser.
- The server listens on `127.0.0.1`, so only your own computer can reach it.

## Troubleshooting

If you see `RPC_INIT_TIMEOUT`, the QVAC worker was slow to start. `server.js` already waits 3 minutes.
Set `QVAC_RPC_INIT_TIMEOUT_MS` (milliseconds) before `npm start` to wait longer, and make sure no other
QVAC app is running at the same time. If you see `ERR_MODULE_NOT_FOUND`, delete the `node_modules` folder
and run `npm install` again (this usually means an install was interrupted, for example by a full disk).

## License

MIT
