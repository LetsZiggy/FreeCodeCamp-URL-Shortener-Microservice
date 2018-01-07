const http = require('http');
const fs = require('fs');
const mongo = require('mongodb').MongoClient;

let dbURL = `mongodb://${process.env.DBUSER}:${process.env.DBPASSWORD}@ds245687.mlab.com:45687/freecodecamp`;
let html = null;
let css = null;
let takenIDs = [];
let addedURLs = [];

fs.readFile('./www/index.html', (err, data) => {
  if(err) { console.log(err); throw err; }
  else {
    html = data;
  }
});

fs.readFile('./www/style.css', (err, data) => {
  if(err) { console.log(err); throw err; }
  else {
    css = data;
  }
});

mongo.connect(dbURL, (err, client) => {
  if(err) { console.log(err); throw err; }
  else {
    const db = client.db('freecodecamp');

    db.collection('url-shortener-microservice')
      .find({ name: 'list' })
      .project({ _id: 0, shorts: 1, urls: 1 })
      .toArray((err, result) => {
        if(err) { console.log(err); throw err; }
        else {
          takenIDs = [...result[0].shorts];
          addedURLs = [...result[0].urls];
        }
      }
    );
  }

  client.close();
});

let characters = [
  '0','1','2','3','4','5','6','7','8','9',
  'a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z',
  'A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'
];

function createNewId() {
  let container = { run: true, data: null };
  while(container.run) {
    let tempID = [];

    for(let i = 0; i < 4; i++) {
      let index = Math.floor(Math.random() * 62);
      tempID.push(characters[index]);
    }

    tempID = tempID.join('');
    if(takenIDs.indexOf(tempID) === -1) {
      container.run = false;
      container.data = tempID;
    }
  }

  return(container.data);
}

function determineQuery(query) {
  let ifNew = query.slice(0, 3);

  if(ifNew === 'new') {
    let regex = new RegExp(/^https?:\/\/\w{3,}\.\w+\.\w{2,}$/);
    let content = query.slice(4);
    let index = addedURLs.indexOf(content);

    if(index !== -1) {
      return({ message: 'added', data: { original: `${content}`, url: takenIDs[index] }});
    }
    else if(regex.test(content)) {
      let newID = createNewId();

      mongo.connect(dbURL, (err, client) => {
        if(err) { console.log(err); throw err; }
        else {
          const db = client.db('freecodecamp');

          db.collection('url-shortener-microservice')
            .update(
              { name: 'list' },
              { $push: { shorts: newID, urls: content }}
          );
        }

        client.close();
      });
      
      takenIDs.push(newID);
      addedURLs.push(content);

      return({ message: 'new', data: { original: `${content}`, url: newID }});
    }

    return({ message: 'error', data: { message: 'Unusable URL', url: `${content}` }});
  }
  else {
    let index = takenIDs.indexOf(query);

    if(index !== -1) {
      return({ message: 'found', data: { url: addedURLs[index] }});
    }
    else {
      return({ message: 'error', data: { message: 'Wrong code', code: query }});
    }
  }
}

function createRedirectMessage(data) {
  return(`<!DOCTYPE html>
          <html>
            <head>
              <meta http-equiv='refresh' content='0; URL=${data}'>
            </head>
          </html>`);
}

let server = http.createServer((req, res) => {
  req.url = req.url.slice(1);
  if(req.url === '') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  }
  else if(req.url.includes('style.css')) {
    res.writeHead(200, { 'Content-Type': 'text/css' });
    res.end(css);
  }
  else if(req.url.includes('favicon.ico')) {
    res.writeHead(200, { 'Content-Type': 'image/x-icon' });
    res.end('https://cdn.glitch.com/22aed6df-466d-4435-bab7-885f082a7563%2Fblog_logo.ico?1515233098046');
  }
  else {
    let query = determineQuery(req.url);
    if(query.message === 'error') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(JSON.stringify(query.data));
    }
    else if(query.message === 'new' || query.message === 'added') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(JSON.stringify({ original_url: query.data.original, short_url: `https://letsziggy-freecodecamp-url-shortener-microservice.glitch.me/${query.data.url}` }));
    }
    else if(query.message === 'found') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(createRedirectMessage(query.data.url));
    }
  }
}).on('error', (err) => { console.log(err); throw err; });

let listener = server.listen(process.env.PORT, () => {
  console.log('Your app is listening on port ' + listener.address().port);
});