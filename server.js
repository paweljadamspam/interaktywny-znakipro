const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
const STATE_FILE = "/data/state.json"; // Render persistent disk

// USDC Mint
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

// Adresy
const addresses = [
  "BAQL4y1J8hae4UM9asN8a8RtjZsjShG8XXErEFQN9YDu",
  "58NojM9qwc7F38oYQAZwDUkArioCbSburkZTBJqLWQd7",
  "FZK29Xj757Z5qPD78gRm7kiZYqyt6szKrSEwdrxwjmPm"
];
const fourthAddress = "H2YZvBUUTnU8bVFR5soC7YaApAeBV5vEaPisrrtzxEvH";

// Wczytaj lub utwórz stan
function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    return JSON.parse(fs.readFileSync(STATE_FILE));
  }
  return {
    baseline: [0,0,0,0],
    unlocked: [false,false,false],
    totalReceived: [0,0,0]
  };
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state));
}

let state = loadState();

// Pobranie salda USDC danego adresu
async function getBalance(address) {
  const res = await fetch("https://api.mainnet-beta.solana.com", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({
      jsonrpc:"2.0",
      id:1,
      method:"getTokenAccountsByOwner",
      params:[
        address,
        { mint: USDC_MINT },
        { encoding: "jsonParsed" }
      ]
    })
  });

  const data = await res.json();
  let balance = 0;
  if (data.result && data.result.value) {
    for (const acct of data.result.value) {
      balance += parseInt(acct.account.data.parsed.info.tokenAmount.amount);
    }
  }
  return balance / 1000000;
}

// Endpoint /state
app.get("/state", async (req,res)=>{
  try{
    // Pobierz obecne salda
    const balances = [];
    for(let i=0;i<3;i++){
      balances[i] = await getBalance(addresses[i]);
    }
    const fourthBalance = await getBalance(fourthAddress);

    // Sprawdź odblokowania 1-3
    for(let i=0;i<3;i++){
      const diff = balances[i] - state.baseline[i];
      if(!state.unlocked[i] && diff >= 1){
        state.unlocked[i] = true;
      }
      state.totalReceived[i] = diff;
    }

    // Sprawdź czwarty adres → odblokuj wszystkie
    if(fourthBalance !== state.baseline[3]){
      state.unlocked = [true,true,true];
    }

    // Zaktualizuj baseline jeśli pierwszy start
    for(let i=0;i<3;i++){
      if(state.baseline[i]===0) state.baseline[i] = balances[i];
    }
    if(state.baseline[3]===0) state.baseline[3] = fourthBalance;

    saveState(state);

    res.json({
      unlocked: state.unlocked,
      totalReceived: state.totalReceived
    });

  }catch(err){
    console.error(err);
    res.status(500).json({error:"RPC error"});
  }
});

app.listen(PORT,()=>console.log("Backend działa na porcie",PORT));
