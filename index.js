import axios from 'axios';
import { parseString } from 'xml2js';
import fs from 'fs';
import http from 'http';

/*const server = http.createServer((req, res) => {
  JSON.parse(queryTerms).forEach(fetchDataForTerm);
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

JSON.parse(queryTerms).forEach(fetchDataForTerm);




