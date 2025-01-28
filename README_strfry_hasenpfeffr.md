strfry + neo4j
=====

Purpose: put strfry and neo4j onto a single instance and establish a pipeline of data from the strfry LMDB database into neo4j.

## Progress

as of 16 Jan 2025: strfry and neo4j run successfully on the same instance. One change had to be made to the strfry deployment documentation to the ufw firewall settings, as detailed below. 

Unfortunately, I cannot read the strfry LMDB database `/var/lib/strfry` using custom scripts without triggering a segfault. Not sure why. Will next try same thing but khatru + neo4j and see how it goes.

## Steps taken

create new AWS EC2 instance

SSH into instance

associate elastic IP address

Security settings: 7474, 7687

point relay.hasenpfeffr.com to elastic IP address 

## install neo4j

install neo4j following https://neo4j.com/docs/operations-manual/current/installation/linux/debian/#debian-installation:

sudo apt-get update
sudo add-apt-repository -y ppa:openjdk-r/ppa
sudo apt-get update
sudo apt install java-common
wget -O - https://debian.neo4j.com/neotechnology.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/neotechnology.gpg
echo 'deb [signed-by=/etc/apt/keyrings/neotechnology.gpg] https://debian.neo4j.com stable latest' | sudo tee -a /etc/apt/sources.list.d/neo4j.list
sudo apt-get update
apt list -a neo4j
java -version // Command 'java' not found ...

sudo apt-get install neo4j=1:5.26.1 (latest version)

java -version // openjdk version "17.0.13" 2024-10-15 ... (apparently installing neo4j also installs java)
sudo nano /etc/neo4j/neo4j.conf
// make these changes to the file:

server.bolt.listen_address=0.0.0.0:7687
server.http.listen_address=0.0.0.0:7474
server.https.listen_address=0.0.0.0:7473

initial.dbms.default_database=hasenpfeffr
server.memory.heap.initial_size=4g
server.memory.heap.max_size=4g
dbms.security.procedures.unrestricted=gds.*
dbms.security.procedures.allowlist=gds.*

sudo service neo4j start
neo4j status

check http://x.x.x.x:7474 and see dashboard

http://relay.hasenpfeffr.com:7474 WORKS!

## strfry deployment 

follow https://github.com/hoytech/strfry/blob/master/docs/DEPLOYMENT.md

!!!!!

`sudo ufw enable` disrupts neo4j access by port 7474 if `sudo ufw default deny incoming`, but does not disrupt if `sudo ufw default allow incoming`

## install node-lmdb 

follow https://github.com/Venemo/node-lmdb

sudo apt install npm

# Install node-gyp globally (needs admin permissions)
sudo npm -g install node-gyp

# Clone node-lmdb
# git clone git@github.com:Venemo/node-lmdb.git # permission denied

git clone https://github.com/Venemo/node-lmdb.git # worked

# Go to node-lmdb directory
cd node-lmdb

# At first, you need to download all dependencies
npm install

# Once you have all the dependencies, the build is this simple
node-gyp configure
node-gyp build

ran into problem when trying to run first example script:
Error: The module '/home/ubuntu/node-lmdb/build/Release/node-lmdb.node'
was compiled against a different Node.js version using
NODE_MODULE_VERSION 108. This version of Node.js requires
NODE_MODULE_VERSION 109. Please try re-compiling or re-installing

So, installing nvm following https://github.com/nvm-sh/nvm and https://www.freecodecamp.org/news/node-version-manager-nvm-install-guide/

curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

source ~/.bashrc

nvm use 18.19.1
nvm install 18.19.1

seemed to do the trick. 

nvm install 18.19.0
nvm use 18.19.0

## TODO

Figure out how to set up ETL pipeline of events from `/var/lib/strfry/data.mdb` to neo4j.

See https://github.com/hoytech/strfry/blob/master/docs -- plugins? router?
https://lmdb.readthedocs.io/en/release/ ?
https://kb.symas.com ?
https://github.com/anywhichway/lmdb-query ?

installed with strfry:
liblmdb-dev


etl-pipeline/1-test-readStrfry.js:

```
var lmdb = require('/home/ubuntu/node-lmdb');
var env = new lmdb.Env();
env.open({
    // Path to the environment
    path: "/var/lib/strfry",
    // Maximum number of databases
    maxDbs: 10
});

// Begin transaction
var txn = env.beginTxn();

// Create cursor
var cursor = new lmdb.Cursor(txn, dbi);

for (var found = cursor.goToFirst(); found !== null; found = cursor.goToNext()) {
    console.log("-----> key:", found);
}

// Close cursor
cursor.close();

// Commit transaction
txn.commit();

dbi.close();
env.close();
```

node 1-testreadStrfry.js

npm install node-lmdb@latest

npm install lmdb

Segmentation fault (core dumped)

npm install lmdb-query

Segmentation fault (core dumped)

I keep getting Segmentation fault (core dumped) whenever trying to access strfry database. Even after copying from /var/lin/strfry to /hom/ubuntu/etl-pipeline which is where the test scripts are, changing ownership to ubuntu and adjusting file types to match the test databases which are readily accessible.