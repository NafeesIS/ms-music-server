const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken')
require('dotenv').config();
const { ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' })
    }

    const token = authorization.split(' ')[1]

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
    })
}

const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.szch3sf.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();


        const classCollection = client.db("MSMusic").collection("classes");
        const newClassCollection = client.db("MSMusic").collection("newclasses");
        const selectedClassesCollection = client.db("MSMusic").collection("selected_classes");
        const instructorCollection = client.db("MSMusic").collection("instructors");
        const feedbackCollection = client.db("MSMusic").collection("feedback");
        const usersCollection = client.db("MSMusic").collection("users");

        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ token })
        })

        app.post('/users', async (req, res) => {
            const user = req.body;

            // Check if the email already exists
            const existingUser = await usersCollection.findOne({ email: user.email });
            if (!existingUser) {
                // Set the default role as "student"
                user.role = "student";

                // Add the new user to the collection
                const result = await usersCollection.insertOne(user);
                res.send(result || {});
            } else {
                res.send({ error: 'Email already exists' });
            }
        });


        app.get('/users', async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        })

        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const result = { admin: user?.role === 'admin' };
            res.send(result)
        })
        app.get('/users/instructor/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const result = { instructor: user?.role === 'instructor' };
            res.send(result)
        })
        app.get('/users/student/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const result = { student: user?.role === 'student' };
            res.send(result)
        })

        app.patch('/users/admin/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'admin'
                }
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result)
        })

        app.patch('/users/instructor/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'instructor'
                }
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result)
        })

        app.get('/classes', async (req, res) => {
            const result = await classCollection.find().toArray();
            res.send(result);
        })

        app.get('/newclasses', async (req, res) => {
            const result = await newClassCollection.find().toArray();
            res.send(result);
        })

        app.get('/newclasses/:id', async (req, res) => {
            const id = req.params.id;

            try {
                const filter = { _id: new ObjectId(id) };
                const classItem = await newClassCollection.findOne(filter);

                if (!classItem) {
                    return res.status(404).json({ message: 'Class not found' });
                }

                res.json(classItem);
            } catch (error) {
                console.error(error);
                res.status(500).json({ message: 'Server error' });
            }
        });

        app.patch('/newclasses/:id', async (req, res) => {
            const id = req.params.id;
            const updatedClassData = req.body;

            try {
                const filter = { _id: new ObjectId(id) };
                const updateDoc = { $set: updatedClassData };

                const result = await newClassCollection.updateOne(filter, updateDoc);

                if (result.matchedCount === 0) {
                    return res.status(404).json({ message: 'Class not found' });
                }

                res.json({ updatedCount: result.modifiedCount });
            } catch (error) {
                console.error(error);
                res.status(500).json({ message: 'Server error' });
            }
        });

        app.post('/selected_classes', async (req, res) => {
            const item = req.body;
            const result = await selectedClassesCollection.insertOne(item);
            res.send(result);
        })
        app.post('/newclasses', async (req, res) => {
            const item = req.body;
            const result = await newClassCollection.insertOne(item);
            res.send(result);
        })

        app.get('/selected_classes', verifyJWT, async (req, res) => {
            const email = req.query.email;
            if (!email) {
                return res.send([])
            }

            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }

            const query = { email: email }
            const result = await selectedClassesCollection.find(query).toArray();
            res.send(result);
        })
        app.get('/newclasses', verifyJWT, async (req, res) => {
            const email = req.query.email;
            if (!email) {
                return res.send([])
            }

            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }

            const query = { email: email }
            const result = await newClassCollection.find(query).toArray();
            res.send(result);
        })
        app.delete('/selected_classes/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await selectedClassesCollection.deleteOne(query);
            res.send(result)
        })
        app.delete('/users/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const query = { _id: new ObjectId(id) };

                const result = await usersCollection.deleteOne(query);

                if (result.deletedCount === 0) {
                    return res.status(404).json({ message: 'User not found' });
                }

                res.json({ deletedCount: result.deletedCount });
            } catch (error) {
                console.error(error);
                res.status(500).json({ message: 'Server error' });
            }
        });
        app.get('/instructors', async (req, res) => {
            const result = await instructorCollection.find().toArray();
            res.send(result);
        })

        app.get('/feedback', async (req, res) => {
            const result = await feedbackCollection.find().toArray();
            res.send(result);
        })


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('MS Music is running');
})

app.listen(port, () => {
    console.log(`MS Music is running on port ${port}`)
})