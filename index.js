import axios from 'axios';
import { parseString } from 'xml2js';
import fs from 'fs';
import http from 'http';
import amqp from 'amqplib';

/*const server = http.createServer((req, res) => {
  JSON.parse(queryTerms).forEach(fetchDataForTerm);
  //startServer();
  //startClient();
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello, this is your server responding!');
});

const port = 3000;

server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});*/

const outputDirectory = 'output';
const queryTermsFilePath = 'terms.js';

const queryTerms = fs.readFileSync(queryTermsFilePath, 'utf-8');

if (!fs.existsSync(outputDirectory)) {
  fs.mkdirSync(outputDirectory);
}

const fetchDataForTerm = async (term) => {
  const url = `https://news.google.com/rss/search?q=${term}&hl=en-IN&gl=IN&ceid=IN%3Aen`;
  const outputFilePath = `${outputDirectory}/${term}_output.json`;

  try {
    const response = await axios.get(url);
    const xmlData = response.data;
    console.log('check', xmlData)
    parseString(xmlData, (err, result) => {
      if (err) {
        console.error(`Error converting XML to JSON for term "${term}":`, err);
        return;
      }
      const jsonData = JSON.stringify(result, null, 2);
      fs.writeFileSync(outputFilePath, jsonData);

      console.log(`Data for term "${term}" successfully converted to JSON and saved to ${outputFilePath}`);
    });
  } catch (error) {
    console.error(`Error fetching data for term "${term}":`, error.message);
  }
};

//JSON.parse(queryTerms).forEach(fetchDataForTerm);

async function startServer() {
  const connection = await amqp.connect('amqp://localhost');
  const channel = await connection.createChannel();

  const queue = 'rpc_queue';

  await channel.assertQueue(queue, { durable: false });
  channel.prefetch(1);

  console.log('Awaiting RPC requests...');

  channel.consume(queue, async (msg) => {
    const requestData = JSON.parse(msg.content.toString());

    console.log(`Received request for URL: ${requestData.url}`);

    try {
      const response = await axios.get(requestData.url);
      const result = response.data;

      channel.sendToQueue(
        msg.properties.replyTo,
        Buffer.from(JSON.stringify(result)),
        { correlationId: msg.properties.correlationId }
      );

      channel.ack(msg);
    } catch (error) {
      console.error(`Error processing request for URL: ${requestData.url}`, error);

      // Handle error and send an appropriate response
      const errorResponse = { error: 'Failed to fetch data' };

      channel.sendToQueue(
        msg.properties.replyTo,
        Buffer.from(JSON.stringify(errorResponse)),
        { correlationId: msg.properties.correlationId }
      );

      channel.ack(msg);
    }
  });
}

//startServer()

async function startClient() {
  const connection = await amqp.connect('amqp://localhost');
  const channel = await connection.createChannel();

  const queue = 'rpc_queue';

  console.log(queryTerms)

  JSON.parse(queryTerms).forEach(term => {
    console.log(term)
    const url = `https://news.google.com/rss/search?q=${term}&hl=en-IN&gl=IN&ceid=IN%3Aen`;
    const result = sendRequest(channel, queue, term, { url });
    console.log(`Result for URL ${url}: ${result.success ? 'Success' : 'Failure'}. File: ${result.filename}`);
  })

  //await connection.close();
}

async function sendRequest(channel, queue, term, requestData) {
  const correlationId = generateUuid();
  const { queue: replyQueue } = await channel.assertQueue('', { exclusive: true });

  channel.consume(replyQueue, (msg) => {
    if (msg.properties.correlationId === correlationId) {
      console.log(`Received response: ${JSON.parse(msg.content)}`);
      parseString(JSON.parse(msg.content), (err, result) => {
        if (err) {
          console.error(`Error converting XML to JSON for term "${term}":`, err);
          return;
        }
        const jsonData = JSON.stringify(result, null, 2);
        const outputFilePath = `${outputDirectory}/${term}_output.json`;
        fs.writeFileSync(outputFilePath, jsonData);
  
        console.log(`Data for term "${term}" successfully converted to JSON and saved to ${outputFilePath}`);
      });
      // Resolve the promise with the received result
      //resolve(JSON.parse(msg.content.toString()));
    }
  }, { noAck: true });

  channel.sendToQueue(queue, Buffer.from(JSON.stringify(requestData)), {
    correlationId: correlationId,
    replyTo: replyQueue
  });

  return new Promise((resolve) => {
    // This promise will be resolved when a response is received
  });
}

function generateUuid() {
  return Math.random().toString() +
         Math.random().toString() +
         Math.random().toString();
}

//startClient();


const server = async () => {
  const connection = await amqp.connect('amqp://localhost');
  const channel = await connection.createChannel();

  const senderQueue = channel.assertQueue('termQueue', {durable: true});
  const replyQueue = channel.assertQueue('', {durable: true});

  channel.consume(replyQueue, (msg) => {
    console.log(msg);
    parseString(JSON.parse(msg.content), (err, result) => {
      if (err) {
        console.error(`Error converting XML to JSON for term "${term}":`, err);
        return;
      }
      const jsonData = JSON.stringify(result, null, 2);
      const outputFilePath = `${outputDirectory}/${term}_output.json`;
      fs.writeFileSync(outputFilePath, jsonData);

      console.log(`Data for term "${term}" successfully converted to JSON and saved to ${outputFilePath}`);
    });
  });

  channel.sendToQueue(senderQueue, Buffer.from(JSON.stringify(msg)), {
    correlationId:'',
    replyTo: replyQueue
  });
}

server();

const consumer = async () => {
  const connection = await amqp.connect('amqp://localhost');
  const channel = await connection.createChannel();

  const senderQueue = channel.assertQueue('termQueue', {durable: true});

  JSON.parse(queryTerms).forEach(term => {
    console.log(term);
    axios.get(`https://news.google.com/rss/search?q=${term}&hl=en-IN&gl=IN&ceid=IN%3Aen`).then(response => {
      console.log(response.data);
      channel.consume('termQueue', (msg) => {
        channel.sendToQueue(msg.properties.replyTo, response, {});
        channel.ack(msg);
      });
    });
  })
}

consumer();

