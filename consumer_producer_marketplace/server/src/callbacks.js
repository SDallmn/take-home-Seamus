import { ClassicListenersCollector } from "@empirica/core/admin/classic";
import OpenAI from "openai";

// import { getconsumerAgentFromId } from "../../client/src/strategie/ConsumerAgent.js"

export const Empirica = new ClassicListenersCollector();

const fs = require('fs');
const path = require('path');

const folderPath = '/';
const fileName = 'choices_consumer.json';
const filePath = path.join(folderPath, fileName);

// function appendObjectToJSON(newObject) {
//   // Check if the folder exists
//   fs.access(folderPath, fs.constants.F_OK, (err) => {
//     if (err) {
//       // Folder doesn't exist, create it
//       fs.mkdir(folderPath, { recursive: true }, (err) => {
//         if (err) {
//           console.error('Error creating folder:', err);
//         } else {
//           console.log('Folder created successfully!');
//           createFileAndAppend(newObject);
//         }
//       });
//     } else {
//       // Folder exists, proceed to create file and append
//       createFileAndAppend(newObject);
//     }
//   });
// }

// function createFileAndAppend(newObject) {
//   // Check if the file exists
//   fs.access(filePath, fs.constants.F_OK, (err) => {
//     if (err) {
//       // File doesn't exist, create it with initial structure
//       const initialData = { dataList: [] };
//       writeToFile(initialData, newObject);
//     } else {
//       // File exists, proceed to read and append
//       readFileAndAppend(newObject);
//     }
//   });
// }

// function readFileAndAppend(newObject) {
//   // Read the existing JSON file
//   fs.readFile(filePath, 'utf8', (err, data) => {
//     if (err) {
//       console.error('Error reading JSON file:', err);
//       return;
//     }

//     try {
//       // Parse JSON content
//       const jsonData = JSON.parse(data);

//       // Modify the object (assuming it's an array called 'dataList')
//       jsonData.dataList.push(newObject);

//       // Write back to the JSON file
//       writeToFile(jsonData, newObject);
//     } catch (parseError) {
//       console.error('Error parsing JSON:', parseError);
//     }
//   });
// }

// function writeToFile(data, newObject) {
//   // Convert data to JSON
//   const updatedJson = JSON.stringify(data, null, 2);

//   // Write back to the JSON file
//   fs.writeFile(filePath, updatedJson, 'utf8', (err) => {
//     if (err) {
//       console.error('Error writing to JSON file:', err);
//     } else {
//       console.log('Object appended successfully!');
//     }
//   });
// }

// Function to update the score of consumers
async function updateConsumerScores(game) {
  await game.players.forEach(async (player) => {
    if (player.get("role") !== "consumer") return;
    const basket = player.get("basket");
    const wallet = player.get("wallet");
    const round = player.round.get("round")
    const originalScore = player.get("score") || 0;
    let score = player.get("score") || 0;
    basket.forEach((item) => {
      if (item.round === round) {
        score += (item.value - item.productPrice) * item.quantity;
      }
    });
    player.set("score", score);
    player.set("scoreDiff", score - originalScore);
  });
}

// Function to update the score of producers
async function updateProducerScores(game) {
  await game.players.forEach(async (player) => {
    if (player.get("role") !== "producer") return;
    const round = player.round.get("round");
    const capital = player.get("capital");
    const tempStock = player.get("stock");
    const currentStock = tempStock.find((item) => item.round === round);
    const remainingStock = currentStock.remainingStock;
    const wallet = player.get("wallet");
    const productPrice = currentStock.productPrice;
    const productCost = currentStock.productCost;
    const productQuality = currentStock.productQuality
    const productAdQuality = currentStock.productAdQuality
    const initialStock = currentStock.initialStock;
    const value = currentStock.value;
    const agents = game.get("agents");

    const consumerAgent = agents.find(p => {
      return p.role === "consumer" && p.agent === "artificial"
    })
    const others = agents.filter(p => {
      return p.role !== "consumer" || p.agent !== "artificial"
    })

    // const strategy = getconsumerAgentFromId(consumerAgent.strategy);
    const roundNum = parseInt(round.replace("Round", ""), 10);
    if (consumerAgent.strategy == "gullible") {
      let wallet = consumerAgent.wallet;
      const mockQuantity = parseInt(wallet / productPrice);
      const soldStock = mockQuantity <= remainingStock ? mockQuantity : remainingStock
      if (soldStock == 0) {
        const totalCost = initialStock * productCost;
        const totalSales = soldStock * productPrice;
        const originalScore = player.get("score") || 0;
        let score = player.get("score") || 0;
        score += (totalSales - totalCost);
        consumerAgent.purchaseHistory.push({
          productQuality: productQuality,
          productAdQuality: productAdQuality,
          quantity: 0,
          round: round,
          roundNum: roundNum,
        });
        let consumerScore = consumerAgent.score;
        consumerAgent.scores.push({
          score: consumerScore,
          round: round,
          roundNum: roundNum
        });
        others.forEach(producerAgent => {
          producerAgent.scores.push({
            score: score,
            round: round,
            roundNum: roundNum
          });
          producerAgent.productionHistory.push({
            productQuality: productQuality,
            productAdQuality: productAdQuality,
            initialStock: initialStock,
            remainingStock: remainingStock,
            soldStock: soldStock,
            round: round,
            roundNum: roundNum
          })
        });
        let cheated = productAdQuality === productQuality ? false : productAdQuality === "low" && productQuality === "high" ? false : true
        consumerAgent.cheatedHistory.push(cheated)
        player.set("score", score);
        player.set("scoreDiff", score - originalScore);
        player.set("capital", capital + totalSales);
      }
      else {
        const trialStock = tempStock.map((item) => {
          return item.round === round
            ? {
              ...item,
              remainingStock: item.remainingStock - soldStock,
              soldStock: item.soldStock + soldStock,
            }
            : item;
        });

        player.set("stock", trialStock);
        const totalCost = initialStock * productCost;
        const totalSales = soldStock * productPrice;
        const originalScore = player.get("score") || 0;
        let score = player.get("score") || 0;
        score += (totalSales - totalCost);

        consumerAgent.purchaseHistory.push({
          productQuality: productQuality,
          productAdQuality: productAdQuality,
          quantity: soldStock,
          round: round,
          roundNum: roundNum,
        });
        let consumerScore = consumerAgent.score;
        consumerScore = (value - productPrice) * soldStock;
        consumerAgent.score = consumerScore;
        consumerAgent.scores.push({
          score: consumerScore,
          round: round,
          roundNum: roundNum
        });
        let cheated = productAdQuality === productQuality ? false : productAdQuality === "low" && productQuality === "high" ? false : true
        consumerAgent.cheatedHistory.push(cheated)
        others.forEach(producerAgent => {
          producerAgent.scores.push({
            score: score,
            round: round,
            roundNum: roundNum
          });
          producerAgent.productionHistory.push({
            productQuality: productQuality,
            productAdQuality: productAdQuality,
            initialStock: initialStock,
            remainingStock: remainingStock,
            soldStock: soldStock,
            round: round,
            roundNum: roundNum
          })
        });
        wallet = wallet - parseInt(productPrice * soldStock);
        consumerAgent.wallet = wallet;
        player.set("score", score);
        player.set("scoreDiff", score - originalScore);
        player.set("capital", capital + totalSales);
      }
      others.push(consumerAgent);
      console.log(others);
      game.set("agents", others);
    }
    else if (consumerAgent.strategy == "titfortat") {
      if (roundNum == 1) {
        let wallet = consumerAgent.wallet;
        const mockQuantity = parseInt(wallet / productPrice);
        const soldStock = mockQuantity <= remainingStock ? mockQuantity : remainingStock
        if (soldStock == 0) {
          const totalCost = initialStock * productCost;
          const totalSales = soldStock * productPrice;
          const originalScore = player.get("score") || 0;
          let score = player.get("score") || 0;
          score += (totalSales - totalCost);
          consumerAgent.purchaseHistory.push({
            productQuality: productQuality,
            productAdQuality: productAdQuality,
            quantity: 0,
            round: round,
            roundNum: roundNum,
          });
          let consumerScore = consumerAgent.score;
          consumerAgent.scores.push({
            score: consumerScore,
            round: round,
            roundNum: roundNum
          });
          others.forEach(producerAgent => {
            producerAgent.scores.push({
              score: score,
              round: round,
              roundNum: roundNum
            });
            producerAgent.productionHistory.push({
              productQuality: productQuality,
              productAdQuality: productAdQuality,
              initialStock: initialStock,
              remainingStock: remainingStock,
              soldStock: soldStock,
              round: round,
              roundNum: roundNum
            })
          });
          let cheated = productAdQuality === productQuality ? false : productAdQuality === "low" && productQuality === "high" ? false : true
          consumerAgent.cheatedHistory.push(cheated)
          player.set("score", score);
          player.set("scoreDiff", score - originalScore);
          player.set("capital", capital + totalSales);
        }
        else {
          const trialStock = tempStock.map((item) => {
            return item.round === round
              ? {
                ...item,
                remainingStock: item.remainingStock - soldStock,
                soldStock: item.soldStock + soldStock,
              }
              : item;
          });

          player.set("stock", trialStock);
          const totalCost = initialStock * productCost;
          const totalSales = soldStock * productPrice;
          const originalScore = player.get("score") || 0;
          let score = player.get("score") || 0;
          score += (totalSales - totalCost);

          consumerAgent.purchaseHistory.push({
            productQuality: productQuality,
            productAdQuality: productAdQuality,
            quantity: soldStock,
            round: round,
            roundNum: roundNum,
          });
          let consumerScore = consumerAgent.score;
          consumerScore = (value - productPrice) * soldStock;
          consumerAgent.score = consumerScore;
          consumerAgent.scores.push({
            score: consumerScore,
            round: round,
            roundNum: roundNum
          });
          others.forEach(producerAgent => {
            producerAgent.scores.push({
              score: score,
              round: round,
              roundNum: roundNum
            });
            producerAgent.productionHistory.push({
              productQuality: productQuality,
              productAdQuality: productAdQuality,
              initialStock: initialStock,
              remainingStock: remainingStock,
              soldStock: soldStock,
              round: round,
              roundNum: roundNum
            })
          });
          let cheated = productAdQuality === productQuality ? false : productAdQuality === "low" && productQuality === "high" ? false : true
          consumerAgent.cheatedHistory.push(cheated)
          wallet = wallet - parseInt(productPrice * soldStock);
          consumerAgent.wallet = wallet;
          player.set("score", score);
          player.set("scoreDiff", score - originalScore);
          player.set("capital", capital + totalSales);
        }
      }
      //hasn't cheated and buys 
      else if (roundNum > 1 && consumerAgent.cheatedHistory[roundNum-2] == false) {
        let wallet = consumerAgent.wallet;
        const mockQuantity = parseInt(wallet / productPrice);
        const soldStock = mockQuantity <= remainingStock ? mockQuantity : remainingStock
        if (soldStock == 0) {
          const totalCost = initialStock * productCost;
          const totalSales = soldStock * productPrice;
          const originalScore = player.get("score") || 0;
          let score = player.get("score") || 0;
          score += (totalSales - totalCost);
          consumerAgent.purchaseHistory.push({
            productQuality: productQuality,
            productAdQuality: productAdQuality,
            quantity: 0,
            round: round,
            roundNum: roundNum,
          });
          let consumerScore = consumerAgent.score;
          consumerAgent.scores.push({
            score: consumerScore,
            round: round,
            roundNum: roundNum
          });
          others.forEach(producerAgent => {
            producerAgent.scores.push({
              score: score,
              round: round,
              roundNum: roundNum
            });
            producerAgent.productionHistory.push({
              productQuality: productQuality,
              productAdQuality: productAdQuality,
              initialStock: initialStock,
              remainingStock: remainingStock,
              soldStock: soldStock,
              round: round,
              roundNum: roundNum
            })
          });
          let cheated = productAdQuality === productQuality ? false : productAdQuality === "low" && productQuality === "high" ? false : true
          consumerAgent.cheatedHistory.push(cheated)
          player.set("score", score);
          player.set("scoreDiff", score - originalScore);
          player.set("capital", capital + totalSales);
        }
        else {
          const trialStock = tempStock.map((item) => {
            return item.round === round
              ? {
                ...item,
                remainingStock: item.remainingStock - soldStock,
                soldStock: item.soldStock + soldStock,
              }
              : item;
          });

          player.set("stock", trialStock);
          const totalCost = initialStock * productCost;
          const totalSales = soldStock * productPrice;
          const originalScore = player.get("score") || 0;
          let score = player.get("score") || 0;
          score += (totalSales - totalCost);

          consumerAgent.purchaseHistory.push({
            productQuality: productQuality,
            productAdQuality: productAdQuality,
            quantity: soldStock,
            round: round,
            roundNum: roundNum,
          });
          let consumerScore = consumerAgent.score;
          consumerScore = (value - productPrice) * soldStock;
          consumerAgent.score = consumerScore;
          consumerAgent.scores.push({
            score: consumerScore,
            round: round,
            roundNum: roundNum
          });
          others.forEach(producerAgent => {
            producerAgent.scores.push({
              score: score,
              round: round,
              roundNum: roundNum
            });
            producerAgent.productionHistory.push({
              productQuality: productQuality,
              productAdQuality: productAdQuality,
              initialStock: initialStock,
              remainingStock: remainingStock,
              soldStock: soldStock,
              round: round,
              roundNum: roundNum
            })
          });
          let cheated = productAdQuality === productQuality ? false : productAdQuality === "low" && productQuality === "high" ? false : true
          consumerAgent.cheatedHistory.push(cheated)
          wallet = wallet - parseInt(productPrice * soldStock);
          consumerAgent.wallet = wallet;
          player.set("score", score);
          player.set("scoreDiff", score - originalScore);
          player.set("capital", capital + totalSales);
        }
      }
      //has cheated
      else if (roundNum > 1 && consumerAgent.cheatedHistory[roundNum-2] == true) {
        let wallet = consumerAgent.wallet;
        const soldStock = 0;
        const totalCost = initialStock * productCost;
        const totalSales = soldStock * productPrice;
        const originalScore = player.get("score") || 0;
        let score = player.get("score") || 0;
        score += (totalSales - totalCost);
        consumerAgent.purchaseHistory.push({
          productQuality: productQuality,
          productAdQuality: productAdQuality,
          quantity: 0,
          round: round,
          roundNum: roundNum,
        });
        let consumerScore = consumerAgent.score;
        consumerAgent.scores.push({
          score: consumerScore,
          round: round,
          roundNum: roundNum
        });
        others.forEach(producerAgent => {
          producerAgent.scores.push({
            score: score,
            round: round,
            roundNum: roundNum
          });
          producerAgent.productionHistory.push({
            productQuality: productQuality,
            productAdQuality: productAdQuality,
            initialStock: initialStock,
            remainingStock: remainingStock,
            soldStock: soldStock,
            round: round,
            roundNum: roundNum
          })
        });
        let cheated = productAdQuality === productQuality ? false : productAdQuality === "low" && productQuality === "high" ? false : true
        consumerAgent.cheatedHistory.push(cheated)
        player.set("score", score);
        player.set("scoreDiff", score - originalScore);
        player.set("capital", capital + totalSales);
      }
      others.push(consumerAgent);
      console.log(others);
      game.set("agents", others);
    }
    else if (consumerAgent.strategy == "twopriorrounds") {
      if (roundNum == 1) {
        let wallet = consumerAgent.wallet;
        const mockQuantity = parseInt(wallet / productPrice);
        const soldStock = mockQuantity <= remainingStock ? mockQuantity : remainingStock
        if (soldStock == 0) {
          const totalCost = initialStock * productCost;
          const totalSales = soldStock * productPrice;
          const originalScore = player.get("score") || 0;
          let score = player.get("score") || 0;
          score += (totalSales - totalCost);
          consumerAgent.purchaseHistory.push({
            productQuality: productQuality,
            productAdQuality: productAdQuality,
            quantity: 0,
            round: round,
            roundNum: roundNum,
          });
          let consumerScore = consumerAgent.score;
          consumerAgent.scores.push({
            score: consumerScore,
            round: round,
            roundNum: roundNum
          });
          others.forEach(producerAgent => {
            producerAgent.scores.push({
              score: score,
              round: round,
              roundNum: roundNum
            });
            producerAgent.productionHistory.push({
              productQuality: productQuality,
              productAdQuality: productAdQuality,
              initialStock: initialStock,
              remainingStock: remainingStock,
              soldStock: soldStock,
              round: round,
              roundNum: roundNum
            })
          });
          let cheated = productAdQuality === productQuality ? false : productAdQuality === "low" && productQuality === "high" ? false : true
          consumerAgent.cheatedHistory.push(cheated)
          player.set("score", score);
          player.set("scoreDiff", score - originalScore);
          player.set("capital", capital + totalSales);
        }
        else {
          const trialStock = tempStock.map((item) => {
            return item.round === round
              ? {
                ...item,
                remainingStock: item.remainingStock - soldStock,
                soldStock: item.soldStock + soldStock,
              }
              : item;
          });

          player.set("stock", trialStock);
          const totalCost = initialStock * productCost;
          const totalSales = soldStock * productPrice;
          const originalScore = player.get("score") || 0;
          let score = player.get("score") || 0;
          score += (totalSales - totalCost);

          consumerAgent.purchaseHistory.push({
            productQuality: productQuality,
            productAdQuality: productAdQuality,
            quantity: soldStock,
            round: round,
            roundNum: roundNum,
          });
          let consumerScore = consumerAgent.score;
          consumerScore = (value - productPrice) * soldStock;
          consumerAgent.score = consumerScore;
          consumerAgent.scores.push({
            score: consumerScore,
            round: round,
            roundNum: roundNum
          });
          others.forEach(producerAgent => {
            producerAgent.scores.push({
              score: score,
              round: round,
              roundNum: roundNum
            });
            producerAgent.productionHistory.push({
              productQuality: productQuality,
              productAdQuality: productAdQuality,
              initialStock: initialStock,
              remainingStock: remainingStock,
              soldStock: soldStock,
              round: round,
              roundNum: roundNum
            })
          });
          let cheated = productAdQuality === productQuality ? false : productAdQuality === "low" && productQuality === "high" ? false : true
          consumerAgent.cheatedHistory.push(cheated)
          wallet = wallet - parseInt(productPrice * soldStock);
          consumerAgent.wallet = wallet;
          player.set("score", score);
          player.set("scoreDiff", score - originalScore);
          player.set("capital", capital + totalSales);
        }
      }
      else if (roundNum == 2 && consumerAgent.cheatedHistory[roundNum-2] == false) {
        let wallet = consumerAgent.wallet;
        const mockQuantity = parseInt(wallet / productPrice);
        const soldStock = mockQuantity <= remainingStock ? mockQuantity : remainingStock
        if (soldStock == 0) {
          const totalCost = initialStock * productCost;
          const totalSales = soldStock * productPrice;
          const originalScore = player.get("score") || 0;
          let score = player.get("score") || 0;
          score += (totalSales - totalCost);
          consumerAgent.purchaseHistory.push({
            productQuality: productQuality,
            productAdQuality: productAdQuality,
            quantity: 0,
            round: round,
            roundNum: roundNum,
          });
          let consumerScore = consumerAgent.score;
          consumerAgent.scores.push({
            score: consumerScore,
            round: round,
            roundNum: roundNum
          });
          others.forEach(producerAgent => {
            producerAgent.scores.push({
              score: score,
              round: round,
              roundNum: roundNum
            });
            producerAgent.productionHistory.push({
              productQuality: productQuality,
              productAdQuality: productAdQuality,
              initialStock: initialStock,
              remainingStock: remainingStock,
              soldStock: soldStock,
              round: round,
              roundNum: roundNum
            })
          });
          let cheated = productAdQuality === productQuality ? false : productAdQuality === "low" && productQuality === "high" ? false : true
          consumerAgent.cheatedHistory.push(cheated)
          player.set("score", score);
          player.set("scoreDiff", score - originalScore);
          player.set("capital", capital + totalSales);
        }
        else {
          const trialStock = tempStock.map((item) => {
            return item.round === round
              ? {
                ...item,
                remainingStock: item.remainingStock - soldStock,
                soldStock: item.soldStock + soldStock,
              }
              : item;
          });

          player.set("stock", trialStock);
          const totalCost = initialStock * productCost;
          const totalSales = soldStock * productPrice;
          const originalScore = player.get("score") || 0;
          let score = player.get("score") || 0;
          score += (totalSales - totalCost);

          consumerAgent.purchaseHistory.push({
            productQuality: productQuality,
            productAdQuality: productAdQuality,
            quantity: soldStock,
            round: round,
            roundNum: roundNum,
          });
          let consumerScore = consumerAgent.score;
          consumerScore = (value - productPrice) * soldStock;
          consumerAgent.score = consumerScore;
          consumerAgent.scores.push({
            score: consumerScore,
            round: round,
            roundNum: roundNum
          });
          others.forEach(producerAgent => {
            producerAgent.scores.push({
              score: score,
              round: round,
              roundNum: roundNum
            });
            producerAgent.productionHistory.push({
              productQuality: productQuality,
              productAdQuality: productAdQuality,
              initialStock: initialStock,
              remainingStock: remainingStock,
              soldStock: soldStock,
              round: round,
              roundNum: roundNum
            })
          });
          let cheated = productAdQuality === productQuality ? false : productAdQuality === "low" && productQuality === "high" ? false : true
          consumerAgent.cheatedHistory.push(cheated)
          wallet = wallet - parseInt(productPrice * soldStock);
          consumerAgent.wallet = wallet;
          player.set("score", score);
          player.set("scoreDiff", score - originalScore);
          player.set("capital", capital + totalSales);
        }
      }
      //has cheated
      else if (roundNum == 2 && consumerAgent.cheatedHistory[roundNum-2] == true) {
        let wallet = consumerAgent.wallet;
        const soldStock = 0;
        const totalCost = initialStock * productCost;
        const totalSales = soldStock * productPrice;
        const originalScore = player.get("score") || 0;
        let score = player.get("score") || 0;
        score += (totalSales - totalCost);
        consumerAgent.purchaseHistory.push({
          productQuality: productQuality,
          productAdQuality: productAdQuality,
          quantity: 0,
          round: round,
          roundNum: roundNum,
        });
        let consumerScore = consumerAgent.score;
        consumerAgent.scores.push({
          score: consumerScore,
          round: round,
          roundNum: roundNum
        });
        others.forEach(producerAgent => {
          producerAgent.scores.push({
            score: score,
            round: round,
            roundNum: roundNum
          });
          producerAgent.productionHistory.push({
            productQuality: productQuality,
            productAdQuality: productAdQuality,
            initialStock: initialStock,
            remainingStock: remainingStock,
            soldStock: soldStock,
            round: round,
            roundNum: roundNum
          })
        });
        let cheated = productAdQuality === productQuality ? false : productAdQuality === "low" && productQuality === "high" ? false : true
        consumerAgent.cheatedHistory.push(cheated)
        player.set("score", score);
        player.set("scoreDiff", score - originalScore);
        player.set("capital", capital + totalSales);
      }
      //hasn't cheated and buys available stock
      else if (roundNum > 2 && consumerAgent.cheatedHistory[roundNum-2] == false && consumerAgent.cheatedHistory[roundNum-3] == false) {
        let wallet = consumerAgent.wallet;
        const mockQuantity = parseInt(wallet / productPrice);
        const soldStock = mockQuantity <= remainingStock ? mockQuantity : remainingStock
        if (soldStock == 0) {
          const totalCost = initialStock * productCost;
          const totalSales = soldStock * productPrice;
          const originalScore = player.get("score") || 0;
          let score = player.get("score") || 0;
          score += (totalSales - totalCost);
          consumerAgent.purchaseHistory.push({
            productQuality: productQuality,
            productAdQuality: productAdQuality,
            quantity: 0,
            round: round,
            roundNum: roundNum,
          });
          let consumerScore = consumerAgent.score;
          consumerAgent.scores.push({
            score: consumerScore,
            round: round,
            roundNum: roundNum
          });
          others.forEach(producerAgent => {
            producerAgent.scores.push({
              score: score,
              round: round,
              roundNum: roundNum
            });
            producerAgent.productionHistory.push({
              productQuality: productQuality,
              productAdQuality: productAdQuality,
              initialStock: initialStock,
              remainingStock: remainingStock,
              soldStock: soldStock,
              round: round,
              roundNum: roundNum
            })
          });
          let cheated = productAdQuality === productQuality ? false : productAdQuality === "low" && productQuality === "high" ? false : true
          consumerAgent.cheatedHistory.push(cheated)
          player.set("score", score);
          player.set("scoreDiff", score - originalScore);
          player.set("capital", capital + totalSales);
        }
        else {
          const trialStock = tempStock.map((item) => {
            return item.round === round
              ? {
                ...item,
                remainingStock: item.remainingStock - soldStock,
                soldStock: item.soldStock + soldStock,
              }
              : item;
          });

          player.set("stock", trialStock);
          const totalCost = initialStock * productCost;
          const totalSales = soldStock * productPrice;
          const originalScore = player.get("score") || 0;
          let score = player.get("score") || 0;
          score += (totalSales - totalCost);

          consumerAgent.purchaseHistory.push({
            productQuality: productQuality,
            productAdQuality: productAdQuality,
            quantity: soldStock,
            round: round,
            roundNum: roundNum,
          });
          let consumerScore = consumerAgent.score;
          consumerScore = (value - productPrice) * soldStock;
          consumerAgent.score = consumerScore;
          consumerAgent.scores.push({
            score: consumerScore,
            round: round,
            roundNum: roundNum
          });
          others.forEach(producerAgent => {
            producerAgent.scores.push({
              score: score,
              round: round,
              roundNum: roundNum
            });
            producerAgent.productionHistory.push({
              productQuality: productQuality,
              productAdQuality: productAdQuality,
              initialStock: initialStock,
              remainingStock: remainingStock,
              soldStock: soldStock,
              round: round,
              roundNum: roundNum
            })
          });
          let cheated = productAdQuality === productQuality ? false : productAdQuality === "low" && productQuality === "high" ? false : true
          consumerAgent.cheatedHistory.push(cheated)
          wallet = wallet - parseInt(productPrice * soldStock);
          consumerAgent.wallet = wallet;
          player.set("score", score);
          player.set("scoreDiff", score - originalScore);
          player.set("capital", capital + totalSales);
        }
      }
      //has cheated
      else if (roundNum > 2 && consumerAgent.cheatedHistory[roundNum-2] == true || consumerAgent.cheatedHistory[roundNum-3] == true) {
        let wallet = consumerAgent.wallet;
        const soldStock = 0;
        const totalCost = initialStock * productCost;
        const totalSales = soldStock * productPrice;
        const originalScore = player.get("score") || 0;
        let score = player.get("score") || 0;
        score += (totalSales - totalCost);
        consumerAgent.purchaseHistory.push({
          productQuality: productQuality,
          productAdQuality: productAdQuality,
          quantity: 0,
          round: round,
          roundNum: roundNum,
        });
        let consumerScore = consumerAgent.score;
        consumerAgent.scores.push({
          score: consumerScore,
          round: round,
          roundNum: roundNum
        });
        others.forEach(producerAgent => {
          producerAgent.scores.push({
            score: score,
            round: round,
            roundNum: roundNum
          });
          producerAgent.productionHistory.push({
            productQuality: productQuality,
            productAdQuality: productAdQuality,
            initialStock: initialStock,
            remainingStock: remainingStock,
            soldStock: soldStock,
            round: round,
            roundNum: roundNum
          })
        });
        let cheated = productAdQuality === productQuality ? false : productAdQuality === "low" && productQuality === "high" ? false : true
        consumerAgent.cheatedHistory.push(cheated)
        player.set("score", score);
        player.set("scoreDiff", score - originalScore);
        player.set("capital", capital + totalSales);
      }
      others.push(consumerAgent);
      console.log(others);
      game.set("agents", others);
    }
    else if (consumerAgent.strategy == "llm") {
      if (roundNum == 1) {
        let wallet = consumerAgent.wallet;
        const mockQuantity = parseInt(wallet / productPrice);
        const soldStock = mockQuantity <= remainingStock ? mockQuantity : remainingStock
        if (soldStock == 0) {
          const totalCost = initialStock * productCost;
          const totalSales = soldStock * productPrice;
          const originalScore = player.get("score") || 0;
          let score = player.get("score") || 0;
          score += (totalSales - totalCost);
          consumerAgent.purchaseHistory.push({
            productQuality: productQuality,
            productAdQuality: productAdQuality,
            quantity: 0,
            round: round,
            roundNum: roundNum,
          });
          let consumerScore = consumerAgent.score;
          consumerAgent.scores.push({
            score: consumerScore,
            round: round,
            roundNum: roundNum
          });
          others.forEach(producerAgent => {
            producerAgent.scores.push({
              score: score,
              round: round,
              roundNum: roundNum
            });
            producerAgent.productionHistory.push({
              productQuality: productQuality,
              productAdQuality: productAdQuality,
              initialStock: initialStock,
              remainingStock: remainingStock,
              soldStock: soldStock,
              round: round,
              roundNum: roundNum
            })
          });
          let cheated = productAdQuality === productQuality ? false : productAdQuality === "low" && productQuality === "high" ? false : true
          consumerAgent.cheatedHistory.push(cheated)
          player.set("score", score);
          player.set("scoreDiff", score - originalScore);
          player.set("capital", capital + totalSales);
        }
        else {
          const trialStock = tempStock.map((item) => {
            return item.round === round
              ? {
                ...item,
                remainingStock: item.remainingStock - soldStock,
                soldStock: item.soldStock + soldStock,
              }
              : item;
          });

          player.set("stock", trialStock);
          const totalCost = initialStock * productCost;
          const totalSales = soldStock * productPrice;
          const originalScore = player.get("score") || 0;
          let score = player.get("score") || 0;
          score += (totalSales - totalCost);

          consumerAgent.purchaseHistory.push({
            productQuality: productQuality,
            productAdQuality: productAdQuality,
            quantity: soldStock,
            round: round,
            roundNum: roundNum,
          });
          let consumerScore = consumerAgent.score;
          consumerScore = (value - productPrice) * soldStock;
          consumerAgent.score = consumerScore;
          consumerAgent.scores.push({
            score: consumerScore,
            round: round,
            roundNum: roundNum
          });
          others.forEach(producerAgent => {
            producerAgent.scores.push({
              score: score,
              round: round,
              roundNum: roundNum
            });
            producerAgent.productionHistory.push({
              productQuality: productQuality,
              productAdQuality: productAdQuality,
              initialStock: initialStock,
              remainingStock: remainingStock,
              soldStock: soldStock,
              round: round,
              roundNum: roundNum
            })
          });
          let cheated = productAdQuality === productQuality ? false : productAdQuality === "low" && productQuality === "high" ? false : true
          consumerAgent.cheatedHistory.push(cheated)
          wallet = wallet - parseInt(productPrice * soldStock);
          consumerAgent.wallet = wallet;
          player.set("score", score);
          player.set("scoreDiff", score - originalScore);
          player.set("capital", capital + totalSales);
        }
      }
      //hasn't cheated and buys 
      else if (roundNum > 1 && llmCall(consumerAgent.cheatedHistory) == true) {
        let wallet = consumerAgent.wallet;
        const mockQuantity = parseInt(wallet / productPrice);
        const soldStock = mockQuantity <= remainingStock ? mockQuantity : remainingStock
        if (soldStock == 0) {
          const totalCost = initialStock * productCost;
          const totalSales = soldStock * productPrice;
          const originalScore = player.get("score") || 0;
          let score = player.get("score") || 0;
          score += (totalSales - totalCost);
          consumerAgent.purchaseHistory.push({
            productQuality: productQuality,
            productAdQuality: productAdQuality,
            quantity: 0,
            round: round,
            roundNum: roundNum,
          });
          let consumerScore = consumerAgent.score;
          consumerAgent.scores.push({
            score: consumerScore,
            round: round,
            roundNum: roundNum
          });
          others.forEach(producerAgent => {
            producerAgent.scores.push({
              score: score,
              round: round,
              roundNum: roundNum
            });
            producerAgent.productionHistory.push({
              productQuality: productQuality,
              productAdQuality: productAdQuality,
              initialStock: initialStock,
              remainingStock: remainingStock,
              soldStock: soldStock,
              round: round,
              roundNum: roundNum
            })
          });
          let cheated = productAdQuality === productQuality ? false : productAdQuality === "low" && productQuality === "high" ? false : true
          consumerAgent.cheatedHistory.push(cheated)
          player.set("score", score);
          player.set("scoreDiff", score - originalScore);
          player.set("capital", capital + totalSales);
        }
        else {
          const trialStock = tempStock.map((item) => {
            return item.round === round
              ? {
                ...item,
                remainingStock: item.remainingStock - soldStock,
                soldStock: item.soldStock + soldStock,
              }
              : item;
          });

          player.set("stock", trialStock);
          const totalCost = initialStock * productCost;
          const totalSales = soldStock * productPrice;
          const originalScore = player.get("score") || 0;
          let score = player.get("score") || 0;
          score += (totalSales - totalCost);

          consumerAgent.purchaseHistory.push({
            productQuality: productQuality,
            productAdQuality: productAdQuality,
            quantity: soldStock,
            round: round,
            roundNum: roundNum,
          });
          let consumerScore = consumerAgent.score;
          consumerScore = (value - productPrice) * soldStock;
          consumerAgent.score = consumerScore;
          consumerAgent.scores.push({
            score: consumerScore,
            round: round,
            roundNum: roundNum
          });
          others.forEach(producerAgent => {
            producerAgent.scores.push({
              score: score,
              round: round,
              roundNum: roundNum
            });
            producerAgent.productionHistory.push({
              productQuality: productQuality,
              productAdQuality: productAdQuality,
              initialStock: initialStock,
              remainingStock: remainingStock,
              soldStock: soldStock,
              round: round,
              roundNum: roundNum
            })
          });
          let cheated = productAdQuality === productQuality ? false : productAdQuality === "low" && productQuality === "high" ? false : true
          consumerAgent.cheatedHistory.push(cheated)
          wallet = wallet - parseInt(productPrice * soldStock);
          consumerAgent.wallet = wallet;
          player.set("score", score);
          player.set("scoreDiff", score - originalScore);
          player.set("capital", capital + totalSales);
        }
      }
      //has cheated
      else if (roundNum > 1 && llmCall(consumerAgent.cheatedHistory) == false) {
        let wallet = consumerAgent.wallet;
        const soldStock = 0;
        const totalCost = initialStock * productCost;
        const totalSales = soldStock * productPrice;
        const originalScore = player.get("score") || 0;
        let score = player.get("score") || 0;
        score += (totalSales - totalCost);
        consumerAgent.purchaseHistory.push({
          productQuality: productQuality,
          productAdQuality: productAdQuality,
          quantity: 0,
          round: round,
          roundNum: roundNum,
        });
        let consumerScore = consumerAgent.score;
        consumerAgent.scores.push({
          score: consumerScore,
          round: round,
          roundNum: roundNum
        });
        others.forEach(producerAgent => {
          producerAgent.scores.push({
            score: score,
            round: round,
            roundNum: roundNum
          });
          producerAgent.productionHistory.push({
            productQuality: productQuality,
            productAdQuality: productAdQuality,
            initialStock: initialStock,
            remainingStock: remainingStock,
            soldStock: soldStock,
            round: round,
            roundNum: roundNum
          })
        });
        let cheated = productAdQuality === productQuality ? false : productAdQuality === "low" && productQuality === "high" ? false : true
        consumerAgent.cheatedHistory.push(cheated)
        player.set("score", score);
        player.set("scoreDiff", score - originalScore);
        player.set("capital", capital + totalSales);
      }
      others.push(consumerAgent);
      console.log(others);
      game.set("agents", others);
    }
  });
}
// In line 1159 gpt key has been removed to avoide key being used by scrapers
const openai = require('openai');
async function call(x, y) {
  // Initialize the OpenAI API client with your API key
  //const client = new openai.OpenAI();
  try {
    // Make the API call to generate a completion
    const completion = await client.chat.completions.create({
      messages: [{ role: "system", content: "you will simulate a consumer who is deciding on weather to purchase a product based how that product's quality matches its advertised description. Previously " + x + " out of the " + y + " products you purchased had matching quality. please respond with one word, either yes or no if you would purchase the next product." }],
      model: "gpt-3.5-turbo",
    });

    // Return the completion result
    return completion.choices[0].message.content;
  } catch (error) {
    // Handle any errors that occur during the API call
    console.error("Error calling OpenAI API:", error);
    throw error;
  }
}

function llmCall(cheatedHistory){
  let trueCount = 0;
  let falseCount = 0;
  for (let i = 0; i < cheatedHistory.length; i++) {
    if (cheatedHistory[i] === true) {
        trueCount++;
    } else {
        falseCount++;
    }
  if (call(trueCount, falseCount) == "yes")
    return true
  else
    return false
}
}


// Function to assign roles to players
function assignRoles(game) {
  const treatment = game.get("treatment");
  const producerPercentage = treatment.producerPercentage;
  const players = game.players;
  const numberOfProducers = Math.round(producerPercentage * players.length);

  const shuffledPlayers = [...players].sort(() => 0.5 - Math.random());
  shuffledPlayers.forEach((player, index) => {
    // const role = index < numberOfProducers ? "producer" : "consumer";
    const role = "producer"
    player.set("role", role);
  });
}

Empirica.onGameStart(async ({ game }) => {
  // TODO: Remove hardcoded values
  const numRounds = 5;
  for (let roundNumber = 1; roundNumber <= numRounds; roundNumber++) {
    const round = game.addRound({ name: `Round${roundNumber}` });
    round.addStage({ name: "selectRoleStage", duration: 24000 });
    round.addStage({ name: "stockStage", duration: 24000 });
    // round.addStage({ name: "choiceStage", duration: 24000 });
    round.addStage({ name: "feedbackStage", duration: 24000 });
    round.addStage({ name: "scoreboardStage", duration: 24000 });
  }

  game.players.forEach((player) => {
    player.set("score", 0);
  });
  assignRoles(game);
});

// Empirica.onStageStart(({ stage }) => {
//   switch(stage.get("name")) {

//   }
// })

Empirica.onStageEnded(({ stage }) => {
  switch (stage.get("name")) {
    // case "choiceStage":
    //   updateProducerScores(stage.currentGame);
    //   updateConsumerScores(stage.currentGame);
    //   break;
    case "stockStage":
      updateProducerScores(stage.currentGame);
      break;
  }
});

Empirica.onGameEnded(({ game }) => { });
