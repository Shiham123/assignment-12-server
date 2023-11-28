const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const moment = require('moment/moment');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRETE_KEY);
// const { v4: uuidv4 } = require('uuid');

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
    const visitSurveyCollection = surveyDatabase.collection('visitedSurvey');
    const paymentCollection = surveyDatabase.collection('pro-user');

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

    // const verifyAdmin = async (request, response, next) => {
    //   const email = request.validUser.email;
    //   const query = { email: email };
    //   console.log(query);

    //   const user = await userCollection.findOne(query);
    //   const isAdmin = user?.role === 'admin';

    //   if (!isAdmin)
    //     return response.status(403).send({ message: 'not an admin access' });
    //   next();
    // };

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
      const result = await surveyCollection
        .find({ status: 'pending' })
        .toArray();
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

    app.get('/adminResponse/:email', verifyToken, async (request, response) => {
      const email = request.params.email;
      const query = { surveyorEmail: email, status: 'unpublished' };
      const result = await surveyCollection.find(query).toArray();
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

    app.post('/visitedSurvey', verifyToken, async (request, response) => {
      const cursor = request.body;
      const formattedTime = moment().format('MMMM Do YYYY, h:mm:ss a');
      const dataWithTimeStamp = {
        ...cursor,
        timestamp: formattedTime,
        // visitId: uuidv4(),
      };

      const existingUser = await visitSurveyCollection.findOne({
        userEmail: dataWithTimeStamp.userEmail,
        surveyItemId: dataWithTimeStamp.surveyItemId,
      });

      if (existingUser === null) {
        const result = await visitSurveyCollection.insertOne(dataWithTimeStamp);
        response.status(200).send(result);
        return;
      }

      if (existingUser) {
        response.status(407).send({ message: 'Survey already added' });
        return;
      }
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
          status: request.body.status,
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

    // ? AGGREGATE METHOD
    app.get('/responseItem', async (request, response) => {
      const result = await surveyCollection
        .aggregate([
          { $unwind: { path: '$_id', preserveNullAndEmptyArrays: true } },
          { $addFields: { testIdString: { $toString: '$_id' } } },
          {
            $lookup: {
              from: 'visitedSurvey',
              localField: 'testIdString',
              foreignField: 'surveyItemId',
              as: 'responseData',
            },
          },
          { $unwind: '$responseData' },
          {
            $group: {
              _id: {
                surveyItemId: '$responseData.surveyItemId',
                userName: '$responseData.userName',
                userEmail: '$responseData.userEmail',
                timestamp: '$responseData.timestamp',
                title: '$responseData.title',
                category: '$responseData.category',
              },
              totalVotes: {
                $sum: {
                  $cond: {
                    if: { $eq: ['$responseData.vote', 'yes'] },
                    then: 1,
                    else: 0,
                  },
                },
              },
            },
          },
          {
            $group: {
              _id: '$_id.surveyItemId',
              totalVotesPerItem: { $sum: '$totalVotes' },
              info: { $push: '$_id' },
            },
          },
        ])
        .toArray();

      response.status(200).send(result);
    });

    app.get(
      '/surveyorResponse/:email',
      verifyToken,
      async (request, response) => {
        const email = request.params.email;
        const query = { surveyorEmail: email };
        const resultTwo = await surveyCollection
          .aggregate([
            {
              $match: query,
            },
            {
              $addFields: {
                covertString: { $toString: '$_id' },
              },
            },
            {
              $lookup: {
                from: 'visitedSurvey',
                localField: 'covertString',
                foreignField: 'surveyItemId',
                as: 'resData',
              },
            },
            {
              $unwind: { path: '$resData', preserveNullAndEmptyArrays: true },
            },
            {
              $group: {
                _id: {
                  surveyItemId: '$resData.surveyItemId',
                  userName: '$resData.userName',
                  userEmail: '$resData.userEmail',
                  timestamp: '$resData.timestamp',
                  report: '$resData.report',
                  title: '$resData.title',
                  category: '$resData.category',
                },
                totalVotes: {
                  $sum: {
                    $cond: {
                      if: { $eq: ['$resData.vote', 'yes'] },
                      then: 1,
                      else: 0,
                    },
                  },
                },
              },
            },
            {
              $group: {
                _id: '$_id.surveyItemId',
                totalVotesPerItem: { $sum: '$totalVotes' },
                info: { $push: '$_id' },
              },
            },
          ])
          .toArray();

        response.status(200).send(resultTwo);
      }
    );

    // PAYMENT METHOD
    app.post('/create-payment-intent', async (request, response) => {
      const { price } = request.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card'],
      });
      response.send({ clientSecret: paymentIntent.client_secret });
    });

    app.post('/payment-history', async (request, response) => {
      const cursor = request.body;
      const result = await paymentCollection.insertOne(cursor);
      response.status(200).send(result);
    });

    app.patch('/pro/:email', async (request, response) => {
      const email = request.params.email;
      const query = { email: email };
      const updatedDoc = {
        $set: {
          role: request.body.role,
        },
      };

      const result = await userCollection.updateOne(query, updatedDoc);
      response.status(200).send(result);
    });

    app.get('/pro', async (request, response) => {
      const result = await paymentCollection.find().toArray();
      response.status(200).send(result);
    });

    // ping
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
