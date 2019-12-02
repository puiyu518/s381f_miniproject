const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const fs = require('fs');
const session = require('cookie-session');
const formidable = require('formidable');
const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
const ObjectID = require('mongodb').ObjectID;
const mongourl = "mongodb+srv://test:test@cluster0-exjt8.mongodb.net/test?retryWrites=true&w=majority
";
const dbName = "test";

app.set('view engine', 'ejs');
app.use('/api/*', bodyParser.json());
app.use('/api/*', bodyParser.urlencoded({ extended: true }));

//api get & post
app.get("/api/restaurant", function (req, res) {
    let search = {};
    let client = new MongoClient(mongourl, { useNewUrlParser: true });
    client.connect((err) => {
        try {
            assert.equal(err, null);
        } catch (err) {
            res.status(500).json({ status: "connection failed" }).end();
            return (-1);
        }
        const db = client.db(dbName);

        let result = [];
        search_restaurant(db, search, (restaurant, temp) => {
            client.close();
            if (restaurant.length <= 0) {
                res.status(200).json({}).end();
                return;
            }
            restaurant.forEach((temp_r) => {
                let rest = {};
                rest['restaurant'] = temp_r;
                result.push(rest);
            });
            res.status(200).json(result).end();
        });
    });
});

app.get("/api/restaurant/:type/:data", function (req, res) {
    let search = {};
    if (req.params.type == "building" || req.params.type == "street" || req.params.type == "zipcode") {
        search["address." + req.params.type] = req.params.data;
    } else if (req.params.type == "lat") {
        search["address.coord.0"] = req.params.data;

    }
    else if (req.params.type == "lon") {
        search["address.coord.1"] = req.params.data;

    } else if (req.params.type == "score") {
        search["grades.score"] = req.params.data;
    } else {
        search[req.params.type] = req.params.data;
    }

    let client = new MongoClient(mongourl, { useNewUrlParser: true });
    client.connect((err) => {
        try {
            assert.equal(err, null);
        } catch (err) {
            res.status(500).json({ status: "connection failed" }).end();
            return (-1);
        }
        const db = client.db(dbName);

        let result = [];
        search_restaurant(db, search, (restaurant, temp) => {
            client.close();
            if (restaurant.length <= 0) {
                res.status(200).json({}).end();
                return;
            }
            restaurant.forEach((temp_r) => {
                let rest = {};
                rest['restaurant'] = temp_r;
                result.push(rest);


            });
            res.status(200).json(result).end();

        });
    });
});

app.post('/api/restaurant', function (req, res) {
    let newDoc = {
        "address": {
            "building": null,
            "coord": [
                null,
                null
            ],
            "street": null,
            "zipcode": null
        },
        "borough": null,
        "cuisine": null,
        "grades": [],
        "name": null,
        "restaurant_id": null,
        "owner": null
    };
    var nameFound = false;
    var owner = false;

    for (i in req.body) {
        if (i == "address") {
            for (a in req.body[i]) {
                if (a == "building" || a == "street" || a == "zipcode" || a == "coord") {
                    newDoc[i][a] = req.body[i][a];
                }
            }
        }
        else if (i == "borough" || i == "cuisine" || i == "restaurant_id") {
            newDoc[i] = req.body[i];
        }
        else if (i == "name" && req.body[i] != null) {
            nameFound = true;
            newDoc[i] = req.body[i];
        }
        else if (i == "owner" && req.body[i] != null) {
            owner = true;
            newDoc[i] = req.body[i];
        }
    }
    var resp = {};
    let client = new MongoClient(mongourl, { useNewUrlParser: true });
    if (nameFound && owner) {
        client.connect((err) => {
            try {
                assert.equal(err, null);
            } catch (err) {
                resp['status'] = "Failed";
                res.status(200).type('json').json(newDoc).end();
                return (-1);
            }
            const db = client.db(dbName);
            resp['status'] = "ok";
            db.collection('project_restaurant').insertOne(newDoc, (err, result) => {
                try {
                    assert.equal(err, null);
                } catch (err) {
                    resp['status'] = "Failed";
                    client.close();
                    res.status(200).type('json').json(newDoc).end();
                    return (-1);
                }
                client.close();
                resp['_id'] = newDoc['_id'];
                res.status(200).type('json').json(resp).end();

            });
        });
    }
    else {
        resp['status'] = "Failed";
        client.close();
        res.status(200).type('json').json(resp).end();
    }

});


//app.use
app.use(session({
    secret: 'admin',
    name: 'testapp',
    maxAge: 1000 * 60 * 60

}));

app.use((req, res, next) => {
    if (req.path == '/' || req.path == '/login' || req.path == '/loginSection' || req.path == '/register' || req.path == '/signUp') {
        next();
    }
    else if (req.session.user) {
        next()
    } else {
        res.redirect('/login');
    }

});

app.use((req, res, next) => {
    if (req.path == '/modify' || req.path == '/remove' || req.path == '/rate') {
        let client = new MongoClient(mongourl, { useNewUrlParser: true });
        client.connect((err) => {
            try {
                assert.equal(err, null);
            } catch (err) {
                res.writeHead(500, { "Content-Type": "text/plain" });
                res.end("MongoClient connect() failed!");
                return (-1);
            }
            const db = client.db(dbName);
            search_restaurant(db, req.query, (restaurant, temp) => {
                client.close();
                let name = false;
                if (req.path == '/rate') {
                    for (i in restaurant[0].grades) {
                        if (restaurant[0].grades[i].user == req.session.user) {
                            name = true;
                            break;
                        }
                    }
                    if (name) {
                        res.render('error', { msg: "You have rated already!!!", id: req.query._id });

                    } else {
                        next();
                    }
                }
                else {
                    if (restaurant[0].owner == req.session.user) {
                        next();
                    }
                    else {
                        res.render('error', { msg: "You don't do this!!!", id: req.query._id });
                    }
                }
            });
        });
    } else {
        next()
    }
});



//Login and register get&post
app.get("/login", function (req, res) {
    if (req.query.create == 'success')
        msg = "Create Account successful !!!";
    else if (req.query.login == 'fail')
        msg = "Incorrect User ID or Password !!!";
    else
        msg = "";
    res.render("login", { msg: msg });
});

app.get("/", function (req, res) {
    res.redirect("/login");
});

app.post("/loginSection", function (req, res) {
    const form = new formidable.IncomingForm();
    form.parse(req, (err, fields) => {
        let client = new MongoClient(mongourl, { useNewUrlParser: true });
        client.connect((err) => {
            try {
                assert.equal(err, null);
            } catch (err) {
                res.writeHead(500, { "Content-Type": "text/plain" });
                res.end("MongoClient connect() failed!");
                return (-1);
            }
            const db = client.db(dbName);
            checkLogin(db, fields, (user) => {
                client.close();
                if (user.length > 0) {
                    req.session.user = fields.userid;
                    res.redirect('index');

                }
                else
                    res.redirect('login?login=fail');
            });
        });

    });
});

//create new Account
app.get("/register", function (req, res) {
    res.render("register", { error: "" });
});

app.post("/signUp", function (req, res) {
    if (req.method.toLowerCase() == "post") {
        // parse a file upload
        const form = new formidable.IncomingForm();
        form.parse(req, (err, fields) => {
            let client = new MongoClient(mongourl, { useNewUrlParser: true });
            client.connect((err) => {
                try {
                    assert.equal(err, null);
                } catch (err) {
                    res.writeHead(500, { "Content-Type": "text/plain" });
                    res.end("MongoClient connect() failed!");
                    return (-1);
                }
                const db = client.db(dbName);
                checkUser(db, fields, (user) => {
                    if (user.length <= 0) {
                        createAccount(db, fields, () => {
                            client.close();
                            res.redirect('/login?create=success');

                        })
                    } else {
                        client.close();
                        res.render('register', { error: "User ID already exists" });
                    }

                });

            });
        })

    }
});

//index Page
app.get("/index", function (req, res) {
    let client = new MongoClient(mongourl, { useNewUrlParser: true });
    client.connect((err) => {
        try {
            assert.equal(err, null);
        } catch (err) {
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end("MongoClient connect() failed!");
            return (-1);
        }
        const db = client.db(dbName);
        const user = req.session.user;
        search_restaurant(db, req.query, (restaurant, criteria) => {
            client.close();
            res.render("index", { restaurant: restaurant, user, criteria: JSON.stringify(criteria) });
        });

    });
});

//create New Restaurant
app.get("/createRestaurant", function (req, res) {
    res.render("createRestaurant");
});

app.post("/createR", function (req, res) {
    if (req.method.toLowerCase() == "post") {
        // parse a file upload
        const form = new formidable.IncomingForm();
        let new_r = {};
        let address = {};
        let coord = [];
        form.parse(req, (err, fields, files) => {
            for (i in fields) {
                if (i == "street" || i == "building" || i == "zipcode"
                ) {
                    address[i] = fields[i];
                }
                else if (i == "lon" || i == "lat") {
                    coord.push(fields[i]);
                } else if (i == 'sampleFile') {
                }
                else {
                    new_r[i] = fields[i];
                }
            }
            new_r['address'] = address;
            new_r['address']['coord'] = coord;
            new_r['grades'] = [];
            new_r['owner'] = req.session.user;
            if (files.sampleFile.size != 0 && (files.sampleFile.mimetype === "image/jpeg" || files.sampleFile.mimetype === "image/png" || files.sampleFile.mimetype === "image/jpg")) {
                new_r['mimetype'] == photo.mimetype;
            }


            fs.readFile(files.sampleFile.path, (err, data) => {
                new_r['image'] = new Buffer.from(data).toString('base64');
            });
            let client = new MongoClient(mongourl, { useNewUrlParser: true });
            client.connect((err) => {
                try {
                    assert.equal(err, null);
                } catch (err) {
                    res.writeHead(500, { "Content-Type": "text/plain" });
                    res.end("MongoClient connect() failed!");
                    return (-1);
                }
                const db = client.db(dbName);

                insertRestaurant(db, new_r, (restaurant) => {
                    client.close()
                    res.redirect('display?_id=' + restaurant['_id'])
                });

            });
        });
    }
});


//logout Account
app.get('/logout', function (req, res) {
    req.session = null;
    res.redirect('/login');
});

//display Restaurant Information
app.get("/display", function (req, res) {
    let client = new MongoClient(mongourl, { useNewUrlParser: true });
    client.connect((err) => {
        try {
            assert.equal(err, null);
        } catch (err) {
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end("MongoClient connect() failed!");
            return (-1);
        }
        const db = client.db(dbName);

        search_restaurant(db, req.query, (restaurant, temp) => {
            client.close();
            if (restaurant[0].owner == req.session.user) {
                var user = true;
            }
            for (i in restaurant[0].grades) {
                if (restaurant[0].grades[i].user == req.session.user) {
                    var rate = true;
                    break;
                }
            }
            res.render("display", { restaurant: restaurant, user: user, rate: rate, grade_create: false });

        });
    });
});


//Create Map
app.get("/gmap", function (req, res) {
    res.render("gmap", { lon: req.query.lon, lat: req.query.lat, name: req.query.title });
});


//delete Restaurant
app.get("/remove", function (req, res) {
    let client = new MongoClient(mongourl, { useNewUrlParser: true });
    client.connect((err) => {
        try {
            assert.equal(err, null);
        } catch (err) {
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end("MongoClient connect() failed!");
            return (-1);
        }
        const db = client.db(dbName);

        deleteRestaurant(db, req.query._id, () => {
            client.close();
            res.render("remove");
        });

    });
});


//edit Restaurant info
app.get("/modify", function (req, res) {
    let client = new MongoClient(mongourl, { useNewUrlParser: true });
    client.connect((err) => {
        try {
            assert.equal(err, null);
        } catch (err) {
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end("MongoClient connect() failed!");
            return (-1);
        }
        const db = client.db(dbName);

        search_restaurant(db, req.query, (restaurant, temp) => {
            client.close();
            res.render("modify", { restaurant: restaurant });

        });
    });
});

app.post("/changerestaurant", function (req, res) {
    if (req.method.toLowerCase() == "post") {
        // parse a file upload
        const form = new formidable.IncomingForm();
        let new_r = {};
        let address = {};
        let coord = [];
        form.parse(req, (err, fields, files) => {
            for (i in fields) {
                if (i == "street" || i == "building" || i == "zipcode"
                ) {
                    address[i] = fields[i];
                }
                else if (i == "lon" || i == "lat") {
                    coord.push(fields[i]);
                } else if (i == 'sampleFile') { }
                else {
                    new_r[i] = fields[i];
                }
            }
            new_r['address'] = address;
            new_r['address']['coord'] = coord;
            if (files.sampleFile.size != 0) {
                mimetype = files.sampleFile.type;
                new_r['mimetype'] = mimetype;
                fs.readFile(files.sampleFile.path, (err, data) => {
                    new_r['image'] = new Buffer.from(data).toString('base64');
                });
            }
            let client = new MongoClient(mongourl, { useNewUrlParser: true });
            client.connect((err) => {
                try {
                    assert.equal(err, null);
                } catch (err) {
                    res.writeHead(500, { "Content-Type": "text/plain" });
                    res.end("MongoClient connect() failed!");
                    return (-1);
                }
                const db = client.db(dbName);

                updateRestaurant(db, new_r, () => {
                    client.close()
                    res.redirect('display?_id=' + fields['_id']);
                });

            });
        });

    }
});


//rating 
app.get("/rate", function (req, res) {
    res.render("rate", { _id: req.query._id });
});

app.post("/raterestaurant", function (req, res) {
    if (req.method.toLowerCase() == "post") {
        // parse a file upload
        const form = new formidable.IncomingForm();
        form.parse(req, (err, fields) => {
            let new_doc = {};
            new_doc['score'] = fields.score;
            new_doc['user'] = req.session.user;


            let client = new MongoClient(mongourl, { useNewUrlParser: true });
            client.connect((err) => {
                try {
                    assert.equal(err, null);
                } catch (err) {
                    res.writeHead(500, { "Content-Type": "text/plain" });
                    res.end("MongoClient connect() failed!");
                    return (-1);
                }
                const db = client.db(dbName);

                insertSocre(db, req.query, new_doc, () => {
                    client.close()
                    res.redirect('display?_id=' + req.query._id)
                });

            });

        });
    }
});


//Searching Page 
app.get("/filtering", function (req, res) {
    res.render("filtering");
});

app.get("/search", function (req, res) {
    let search = {};
    const name_value_pairs = Object.entries(req.query);
		name_value_pairs.forEach((value,index,array) => {
			if(value[0] == "street" || value[0] == "building" || value[0] == "zipcode"){
				if(value[1].length>0){
					search["address."+value[0]] = value[1];
				 }
			} 
			  else {
				if(value[1].length>0){
					search[value[0]] = value[1];	
				}
			}
		});

	console.log(search);

    let client = new MongoClient(mongourl, { useNewUrlParser: true });
    client.connect((err) => {
        try {
            assert.equal(err, null);
        } catch (err) {
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end("MongoClient connect() failed!");
            return (-1);
        }
        const db = client.db(dbName);
        
        search_restaurant(db, search, (restaurant) => {
            client.close();
            res.render("SearchResultPage", { restaurant: restaurant, user: req.session.user});
        });

    });
});
    


const createAccount = (db, r, callback) => {
    db.collection('user').insertOne(r, (err, result) => {
        assert.equal(err, null);
        callback();
    });
}

const checkLogin = (db, criteria, callback) => {
    const cursor = db.collection("user").find(criteria);
    cursor.toArray((err, user) => {
        assert.equal(err, null);
        callback(user);
    });
}

const checkUser = (db, criteria, callback) => {
    const cursor = db.collection("user").find({ userid: criteria['userid'] });
    cursor.toArray((err, user) => {
        assert.equal(err, null);
        callback(user);
    });
}

const search_restaurant = (db, criteria, callback) => {

    var jsonReturn = { ...criteria };

    for (temp in criteria) {
        if (temp == '_id') {
            criteria[temp] = ObjectID(criteria[temp]);
        } else
            criteria[temp] = { $regex: criteria[temp], $options: 'i' };
    }
    const cursor = db.collection('project_restaurant').find(criteria);

    cursor.toArray((err, user) => {
        assert.equal(err, null);
        callback(user, jsonReturn);
    });
}

const insertRestaurant = (db, criteria, callback) => {

    db.collection('project_restaurant').insertOne(criteria, (err, result) => {
        assert.equal(err, null);
        callback(result.ops[0]);
    });
}

const insertSocre = (db, criteria, fields, callback) => {
    let temp = {};
    temp['_id'] = ObjectID(criteria._id);
    db.collection('project_restaurant').updateOne(temp,
        { $push: { grades: fields } }, (err, result) => {
            assert.equal(err, null);
            callback()
        });
}

const updateRestaurant = (db, criteria, callback) => {
    let temp = {};
    temp['_id'] = ObjectID(criteria._id);
    delete criteria._id;
    db.collection('project_restaurant').updateOne(temp, { $set: criteria },
        (err, result) => {
            assert.equal(err, null);
            callback()
        });
}

const deleteRestaurant = (db, criteria, callback) => {
    let temp = {};
    temp['_id'] = ObjectID(criteria);
    db.collection('project_restaurant').deleteOne(temp,
        (err, result) => {
            assert.equal(err, null);
            console.log(result);
            callback()
        });
}


app.listen(process.env.PORT || 8099);
