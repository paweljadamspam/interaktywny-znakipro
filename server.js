const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");
const fs = require("fs");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
const STATE_FILE = "/data/state.json";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const addresses = [
  "BAQL4y1J8hae4UM9asN8a8RtjZsjShG8XXErEFQN9YDu",
  "58NojM9qwc7F38oYQAZwDUkArioCbSburkZTBJqLWQd7",
  "FZK29Xj757Z5qPD78gRm7kiZYqyt6szKrSEwdrxwjmPm"
];

const fourthAddress = "H2YZvBUUTnU8bVFR5soC7YaApAeBV5vEaPisrrtzxEvH";

function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    return JSON.parse(fs.readFileSync(STATE_FILE));
  }
  return {
    baseline: null,
    unlocked: [false, false, false],
    totalReceived: [0, 0, 0]
  };
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state));
}

let state = loadState();

async function getBalance(address) {
  const response = await fetch("https://api.mainnet-beta.solana.com", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getTokenAccountsByOwner",
      params: [
        address,
        { mint: USDC_MINT },
        { encoding: "jsonParsed" }
      ]
    })
  });

  const data = await response.json();

  let balance = 0;
  if (data.result && data.result.value) {
    for (const acct of data.result.value) {
      balance += parseInt(acct.account.data.parsed.info.tokenAmount.amount);
    }
  }

  return balance / 1000000;
}

app.get("/state", async (req, res) => {
  try {

    if (!state.baseline) {
      state.baseline = [];
      for (let i = 0; i < 3; i++) {
        state.baseline[i] = await getBalance(addresses[i]);
      }
      state.baseline[3] = await getBalance(fourthAddress);
      saveState(state);
    }

    for (let i = 0; i < 3; i++) {
      const current = await getBalance(addresses[i]);
      const diff = current - state.baseline[i];

      if (!state.unlocked[i] && diff >= 1) {
        state.unlocked[i] = true;
      }

      if (diff > 0) {
        state.totalReceived[i] = diff;
      }
    }

    const fourthCurrent = await getBalance(fourthAddress);

    if (fourthCurrent !== state.baseline[3]) {
      state.unlocked = [true, true, true];
    }

    saveState(state);

    res.json({
      unlocked: state.unlocked,
      totalReceived: state.totalReceived
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "RPC error" });
  }
});

app.listen(PORT, () => {
  console.log("Server działa na porcie", PORT);
});
