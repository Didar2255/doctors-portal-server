const express = require('express')
const admin = require("firebase-admin");
const cors = require('cors')
const { MongoClient } = require('mongodb');
require('dotenv').config()
const app = express()
const port = process.env.PORT || 5000

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

//meddle wear
app.use(cors())
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.gzbym.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function verifyToken(req, res, next) {
    if (req.headers?.authorization?.startsWith('Bearer ')) {
        const token = req.headers.authorization.split(' ')[1]
        try {
            const decodedUser = await admin.auth().verifyIdToken(token)
            req.decodedEmail = decodedUser.email;
        }
        catch {

        }
    }
    next()
}

async function run() {
    try {
        await client.connect()
        const database = client.db('Doctors_portal')
        const appointmentCollection = database.collection('appointments')
        const usersCollection = database.collection('users')

        //get api with email

        app.get('/appointments', verifyToken, async (req, res) => {
            const email = req.query.email;
            const date = req.query.date
            const query = { patientEmail: email, date: date }
            const cursor = appointmentCollection.find(query)
            const result = await cursor.toArray()
            res.send(result)
        })

        // post api
        app.post('/appointments', async (req, res) => {
            const appointment = req.body;
            const result = await appointmentCollection.insertOne(appointment);
            res.json(result)
        })

        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query)
            let isAdmin = false;
            if (user?.role === 'admin') {
                isAdmin = true;
            }
            res.json({ admin: isAdmin })

        })

        // user info post api
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user)
            res.json(result)
        })
        // user info update put api

        app.put('/users', async (req, res) => {
            const user = req.body
            const query = { email: user.email }
            const options = { upsert: true }
            const updateDoc = { $set: user }
            const result = await usersCollection.updateOne(query, updateDoc, options)
            res.json(result)
        })
        //admin info update put api

        app.put('/users/admin', verifyToken, async (req, res) => {
            const user = req.body;
            const requester = req.decodedEmail;
            if (requester) {
                const requesterUser = await usersCollection.findOne({ email: requester });
                if (requesterUser.role === 'admin') {
                    const filter = { email: user.email }
                    const updateDoc = { $set: { role: 'admin' } }
                    const result = await usersCollection.updateOne(filter, updateDoc)
                    res.json(result)
                }
            }
            else {
                res.status(403).json({ message: 'You have no power to make admin sorry' })
            }
        })



    }
    finally {
        // await client.close()
    }

}
run().catch(console.dir)

app.get('/', (req, res) => {
    res.send('Wel-come to Doctor Portal')
})

app.listen(port, () => {
    console.log('Doctor portal server port no :', port)
})