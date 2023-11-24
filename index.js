const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();

app.use(cors());
app.use(express.json());

const port = process.env.PORT || 5000;

// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster-assignment-11.m6efgmp.mongodb.net/?retryWrites=true&w=majority`;
const uri = 'mongodb://localhost:27017';

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

    // Json web token

    app.post('/jwt', async (request, response) => {
      const user = request.body;
      const token = jwt.sign(user, process.env.DB_SECRETE_KEY, {
        expiresIn: '365d',
      });
      response.status(200).send(token);
    });

    // POST METHOD

    app.post('/users', async (request, response) => {
      const user = request.body;
      const query = { email: user.email };

      const existingUser = await userCollection.findOne(query);
      if (existingUser)
        return response
          .status(404)
          .send({ message: 'user exits', inserted: null });

      const result = await userCollection.insertOne(user);
      response.status(200).send(result);
    });

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
