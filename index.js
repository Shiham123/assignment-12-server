const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();

app.use(cors());
app.use(express.json());

const port = process.env.PORT || 5000;

// shihamAssignment11
//shihamAssignment11

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster-assignment-11.m6efgmp.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const run = async () => {
  try {
    // await client.connect();
    const surveyDatabase = client.db('polling-survey');
    const userCollection = surveyDatabase.collection('user');

    await client.db('admin').command({ ping: 1 });
    console.log('You successfully connected to MongoDB!');
  } catch (error) {
    console.dir(error);
  }
};

run();
app.get('/', async (request, response) => {
  response.send('successfully connected');
});

app.listen(port, () => {
  console.log(`server running at http://localhost:${port}`);
});
