const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const addresses = [
  "BAQL4y1J8hae4UM9asN8a8RtjZsjShG8XXErEFQN9YDu",
  "58NojM9qwc7F38oYQAZwDUkArioCbSburkZTBJqLWQd7",
  "FZK29Xj757Z5qPD78gRm7kiZYqyt6szKrSEwdrxwjmPm"
];

const fourthAddress = "H2YZvBUUTnU8bVFR5soC7YaApAeBV5vEaPisrrtzxEvH";

let baseline = null;
let unlocked = [false, false, false];
let totalReceived = [0, 0, 0];

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

    if (!baseline) {
      baseline = [];
      for (let i = 0; i < 3; i++) {
        baseline[i] = await getBalance(addresses[i]);
      }
      baseline[3] = await getBalance(fourthAddress);
    }

    for (let i = 0; i < 3; i++) {
      const current = await getBalance(addresses[i]);
      const diff = current - baseline[i];

      if (!unlocked[i] && diff >= 1) {
        unlocked[i] = true;
      }

      if (diff > 0) {
        totalReceived[i] = diff;
      }
    }

    const fourthCurrent = await getBalance(fourthAddress);

    if (fourthCurrent !== baseline[3]) {
      unlocked = [true, true, true];
    }

    res.json({
      unlocked,
      totalReceived
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "RPC error" });
  }
});

app.listen(PORT, () => {
  console.log("Server działa na porcie", PORT);
});
