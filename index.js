const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const moment = require('moment/moment');
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
    const surveyCollection = surveyDatabase.collection('surveyItems');

    // Json web token

    app.post('/jwt', async (request, response) => {
      const user = request.body;
      const token = jwt.sign(user, process.env.DB_SECRETE_KEY, {
        expiresIn: '365d',
      });
      response.status(200).send(token);
    });

    // verify token

    const verifyToken = (request, response, next) => {
      const validHeaders = request.headers.validation;

      if (!validHeaders) {
        return response.status(401).send({ message: 'not valid token' });
      }
      const token = request.headers.validation.split(' ')[1];
      jwt.verify(token, process.env.DB_SECRETE_KEY, (error, decoded) => {
        if (error) {
          return response.status(402).send({ message: 'not verified' });
        }
        request.validUser = decoded;
        next();
      });
    };

    // GET METHOD
    app.get('/users', verifyToken, async (request, response) => {
      const result = await userCollection.find().toArray();
      response.status(200).send(result);
    });

    app.get('/users/admin/:email', verifyToken, async (request, response) => {
      const email = request.params.email;
      const emailFromValidation = request.validUser.email;

      if (email !== emailFromValidation) {
        return response.status(405).send({ message: 'unauthorized users' });
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let isAdmin = false;

      if (user) {
        isAdmin = user?.role === 'admin';
      }
      response.send({ isAdmin });
    });

    app.get('/users/normal/:email', verifyToken, async (request, response) => {
      const email = request.params.email;
      const validationEmail = request.validUser.email;

      if (email !== validationEmail)
        return response.status(406).send({ message: 'unauthorized users' });

      const query = { email: email };
      const normalUser = await userCollection.findOne(query);
      let isNormalUser = false;

      if (normalUser) {
        isNormalUser = normalUser?.role === 'user';
      }

      response.send({ isNormalUser });
    });

    app.get('/survey', verifyToken, async (request, response) => {
      const result = await surveyCollection.find().toArray();
      response.status(200).send(result);
    });

    app.get('/survey/details/:id', async (request, response) => {
      const id = request.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await surveyCollection.findOne(query);
      response.status(200).send(result);
    });

    app.get('/survey/item', async (request, response) => {
      const result = await surveyCollection
        .find({ status: 'published' })
        .toArray();
      response.status(200).send(result);
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

    app.post('/survey', verifyToken, async (request, response) => {
      const cursor = request.body;
      const formattedTime = moment().format('MMMM Do YYYY, h:mm:ss a');
      const dataWithTimeStamp = {
        ...cursor,
        timestamp: formattedTime,
      };
      const result = await surveyCollection.insertOne(dataWithTimeStamp);
      response.status(200).send(result);
    });

    // PATCH METHOD
    app.patch('/users/admin/:id', verifyToken, async (request, response) => {
      const id = request.params.id;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: request.body.role,
        },
      };
      const result = await userCollection.updateOne(query, updatedDoc);
      response.status(200).send(result);
    });

    app.patch('/survey/:id', verifyToken, async (request, response) => {
      const id = request.params.id;
      const query = { _id: new ObjectId(id) };

      const updatedDoc = {
        $set: {
          status: request.body.status,
        },
      };
      const result = await surveyCollection.updateOne(query, updatedDoc);
      response.status(200).send(result);
    });

    // PUT METHOD
    app.put('/survey/:id', verifyToken, async (request, response) => {
      const id = request.params.id;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          message: request.body.enteredMessage,
        },
      };
      const result = await surveyCollection.updateOne(query, updatedDoc);
      response.status(200).send(result);
    });

    // DELETE METHOD
    app.delete('/users/:id', verifyToken, async (request, response) => {
      const id = request.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
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