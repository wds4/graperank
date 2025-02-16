## Super messy log of what I did to put together the EC2 instance

## purpose 

Purpose of this repo is to repeat the functionality of `interpretation-brainstorm.vercel.app` and `calculation-brainstorm.vercel.app` but with improved performance by moving from vercel to AWS ec2, which scales, and using neo4j as the core database. An API will be exposed for communication with the grapevine front end, similar to what is already functional at `grapevine-brainstorm.vercel.app`. 

An API will also be exposed for communication with nostr clients such as Coracle which will return grapevine data. 
- Goal 1: We may submit a nostr client PR so that grapevine customers can activate a funcionality in settings that will show the DoS and GrapeRank WoT Score on individual profile pages, if such data is available over an API to graperank.tech.
- Goal 2: Expose an API that provides a list of Recommended Pubkeys that can be used in place of follows for the main content feed. Especially useful for new nostr users with only a handful of follows.
- Goal 3 - less well defined: Expose one or more APIs that output a list of GrapeRank WoT Scores which can be used to stratify content, similar to PageRank in keyword search.

This will be a grapevine interpretation and calculation engine merged together.  Will use an AWS ec2 instance that will connect to nostr relays, keep channels open, and maintain a neo4j database of follows and mutes. Will later add reports and other event kinds. 

## log of how this instance was set up

Plan to set up these things that I already know how to do:
- aws ecs instance
- nextjs
- neo4j
- certbot, use `graperank.tech`
- cicd using github actions
- nostr relay (but not yet done this on ec2)

Things I have done but not on ec2:
- nostr relay
- sql on ec2
- S3 bucket on ec2
- auto scaling 

## tutorials

- nginx, certbot, pm2:
    - https://dev.to/j3rry320/deploy-your-nextjs-app-like-a-pro-a-step-by-step-guide-using-nginx-pm2-certbot-and-git-on-your-linux-server-3286
- cicd using github actions
    - https://www.abcsoftwarecompany.com/showcases/deploy-web-application-with-git-hub-actions-ci-cd-and-amazon-web-service-ec-2
    - but modifications to the workflow as per the cicd-test-next repo
- neo4j:
    - https://medium.com/@khasnobis.sanjit890/create-your-own-neo4j-graph-db-instance-at-aws-ec2-fac0f77a57dc
    - https://neo4j.com/docs/operations-manual/current/installation/linux/debian/#debian-installation

## log of steps taken

On local machine:

```
npx create-next-app@latest graperank
```

Synced to GitHub account.

Created AWS EC2 instance: GrapeRankTech. t2.medium, 30 GB.

Added two Inbound rules: 7474, 7867, which will be used with neo4j. 

locally: `chmod 400 "pgftGrapeRanktech.pem"`
use `ssh -i "pgftGrapeRanktech.pem" ubuntu@ec2-44-201-138-209.compute-1.amazonaws.com` to connect

in ec2:

following https://dev.to/j3rry320/deploy-your-nextjs-app-like-a-pro-a-step-by-step-guide-using-nginx-pm2-certbot-and-git-on-your-linux-server-3286

```
sudo apt-get update
sudo apt-get install nginx
sudo apt install npm
sudo npm install -g pm2 
```

install neo4j following https://neo4j.com/docs/operations-manual/current/installation/linux/debian/#debian-installation:

```
sudo apt-get update
sudo add-apt-repository -y ppa:openjdk-r/ppa
sudo apt-get update
sudo apt install java-common
wget -O - https://debian.neo4j.com/neotechnology.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/neotechnology.gpg
echo 'deb [signed-by=/etc/apt/keyrings/neotechnology.gpg] https://debian.neo4j.com stable latest' | sudo tee -a /etc/apt/sources.list.d/neo4j.list
sudo apt-get update
apt list -a neo4j
java -version // Command 'java' not found ...

** I probaby ran (and forgot to record): sudo apt-get install neo4j=1:5.26.1 (or whichever version)

java -version // openjdk version "17.0.13" 2024-10-15 ... (apparently installing neo4j also installs java)
sudo nano /etc/neo4j/neo4j.conf
// make these changes to the file:
initial.dbms.default_database=brainstorm
server.memory.heap.initial_size=4g
server.memory.heap.max_size=4g
server.bolt.listen_address=0.0.0.0:7687
server.http.listen_address=0.0.0.0:7474
server.https.listen_address=0.0.0.0:7473
dbms.security.procedures.unrestricted=gds.*
dbms.security.procedures.allowlist=gds.*
# Increasing the JSON log string maximum length
// server.jvm.additional=-Dlog4j.layout.jsonTemplate.maxStringLength=32768 // already in default
// 
sudo service neo4j restart (or just start)
neo4j status
```

check http://0.0.0.0:7474 and see dashboard; load sample data

```
git clone https://github.com/wds4/graperank.git
cd graperank
npm install
npm run build
pm2 start npm --name "graperank" -- start
sudo nano /etc/nginx/sites-available/graperank.tech
```

Created this file:

```
server {
    listen 80;
    server_name graperank.tech www.graperank.tech;
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```
sudo ln -s /etc/nginx/sites-available/graperank.tech /etc/nginx/sites-enabled/
```

Then went to godaddy and redirected graperank.tech DNS to 52.91.115.172

```
cd .. 
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d graperank.tech -d www.graperank.tech (to my old y addy)
sudo nano /etc/nginx/sites-available/graperank.tech
```

and replaced file with:

```
server {
    listen 80;
    server_name graperank.tech www.graperank.tech;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name graperank.tech www.graperank.tech;

    ssl_certificate /etc/letsencrypt/live/graperank.tech/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/graperank.tech/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```
sudo systemctl restart nginx 
```

Currently http://52.91.115.172 directs to nginx landing page (bc /etc/nginx/sites-available/default) and https://graperank.tech shows nextjs landing page

add secrets to github (settings, secrets and variables, Actions, Repository Secrets)
AWS_EC2_USER: ubuntu 
AWS_EC2_HOST: graperank.tech
AWS_EC2_KEY: my pem key 

Create .github/workflows/deploy.yml (copied from my other repo)

Update, push changes; and I can see update at graperank.tech!

locally: 

```
npm install neo4j-driver
```

add lib/neo4j and /api/tests/neo4j/index.ts

neo4j api endpoint works!! (locally)

## Adding nostr

locally:

```
npm install nostr-tools
npm install @nostr-dev-kit/ndk 
npm install @noble/hashes
```

pushed changes to grapevine.tech; nostr endpoint works!

## Adding s3

follow: https://www.npmjs.com/package/@aws-sdk/client-s3

locally:

```
npm install @aws-sdk/client-s3
```
added /api/tests/s3 endpoint

basic command works!! (locally)

but doesn't work on ec2 ...

locally and in ec2:
```
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_REGION=us-east-1
```

that did not work: ${process.env.AWS_REGION} returns us-east-1 locally but not in ec2

So: add secrets to github (settings, secrets and variables, Actions, Repository Secrets)
AWS_REGION: us-east-1 
AWS_ACCESS_KEY_ID: ... 
AWS_SECRET_ACCESS_KEY: ...

and edit deploy.yml to include those in env 

For now, those 3 env vars are stored in next.config.ts which is excluded using gitignore and updated in ec2 (kept out of repo).  Not sure if that is the proper way to do it. For some reason, process.env.AWS_... works on local machine but not on ec2, even though all 3 of those vars have been exported locally and in ec2.

## mysql

s3 not yet demonstrated to be working; switch now to mysql 

adding mysql, following https://medium.com/@lovelyalice.kim/ep-1-backend-development-aws-ec2-mysql-node-js-fb847050ed87

edited inbound rules, added mysql/aurora 

locally:

```
npm install mysql-server
```

but `mysql -u root -p` fails

try this:
https://www.bacancytechnology.com/blog/connect-mysql-to-ec2-instance

on ec2:

```
sudo apt-get install mysql-server -y
mysql --version 
```
(shows Ver 8.0.39)

```
sudo mysql_secure_installation
```

switching now to mysql2

locally: 

```
npm install --save mysql2
```

can get sql endpoint to connect and function on ec2 (using admin) but not locally 

following https://repost.aws/knowledge-center/duplicate-master-user-mysql to create new user

in ec2

```
mysql > CREATE USER 'pgft_admin'@'%' IDENTIFIED BY '...';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, RELOAD, PROCESS, REFERENCES, INDEX, ALTER, SHOW DATABASES, CREATE TEMPORARY TABLES, LOCK TABLES, EXECUTE, REPLICATION SLAVE, REPLICATION CLIENT, CREATE VIEW, SHOW VIEW, CREATE ROUTINE, ALTER ROUTINE, CREATE USER, EVENT, TRIGGER ON *.* TO 'pgft_admin'@'%' WITH GRANT OPTION;
```

grapevine-nostr-cache-db - able to mysql in via ecs CLI
mysql -h grapevine-nostr-cache-db.cp4a4040m8c9.us-east-1.rds.amazonaws.com -P 3306 -u pgft -p

in ec2, to access mysql and edit database grapevineNostrCacheDb:
```
mysql -h grapevine-nostr-cache-db.cp4a4040m8c9.us-east-1.rds.amazonaws.com -P 3306 -u pgft -p
mysql> use grapevineNostrCacheDb
mysql> show tables
mysql> SELECT * FROM users;
```

## neo4j

via browser:

`CREATE CONSTRAINT FOR (n:NostrUser) REQUIRE (n.pubkey) IS UNIQUE`

## neo4j graph data science

follow instructions https://neo4j.com/docs/graph-data-science/current/installation/neo4j-server/

download `neo4j-graph-data-science-2.12.0.jar` from https://neo4j.com/deployment-center/#gds-tab and move to `/var/lib/neo4j/plugins/`

`sudo nano /etc/neo4j/neo4j.conf`
add `dbms.security.procedures.unrestricted=gds.*`
and `dbms.security.procedures.allowlist=gds.*`
then restarted neo4j `sudo neo4j restart`

## CORS

`sudo nano /etc/nginx/sites-available/graperank.tech`

and change this:

```
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
```

to:

```
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;

        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Accept,Authorization,Cache-Control,Content-Type,DNT,If-Modified-Since,Keep-Alive,Origin,User-Agent,X-Requested-With' always;
    }
```

then: `sudo systemctl restart nginx`

with plan later to change to:

```
add_header 'Access-Control-Allow-Origin' 'https://grapevine-brainstorm.vercel.app/' always;
```
## start automatically on system start

sudo systemctl enable neo4j

## import ManiMe's code

npm i https://github.com/Pretty-Good-Freedom-Tech/graperank-nodejs.git#davidDev 
import { calculate } from 'graperank-nodejs/src/Calculator'
produces: "graperank-nodejs": "github:Pretty-Good-Freedom-Tech/graperank-nodejs#davidDev",

## TODO:
- maybe get rid of nginx landing page (44.215.170.113) (delete /etc/nginx/sites-available/default?)
- https://www.graperank.tech/api/neo4j/getAllFollowsAndMutes (need to do this from LMDB instead of neo4j ???)
- https://www.graperank.tech/api/algos/personalizedPageRank
    - write pPR results to S3 bucket
- include dos and pPR activation from grapevine-brainstorm.vercel.app
- figure out best way to export all kind3 events 
- then start on grapeRank calculation
- get all dos=N pubkeys
- get one random pubkey dos=N
- show compositeWoT as table for graperank app


- when do cronJob5 or cronJob5b, make sure to flag flaggedToUpdateReverseObserveeObject=1, but only if rating is added or removed
- go back to grapeRank endpoint

- use https://www.graperank.tech/api/outwardFacing/getGrapeRank endpoint to show graperank scores on profile page
- fetch pagerank score 

- eliminate duplicate pubkeys
sql already immune to duplicates. So need to merge neo4j nodes with duplicate pubkeys.
They cannot be eliminated from events, 
1. use this to find duplicates
MATCH (n:NostrUser), (m:NostrUser) WHERE lower(n.pubkey)=lower(m.pubkey) AND n.pubkey <> m.pubkey RETURN n,m
2. merge them using cypher query
3. make sure algos never get fooled by duplicates; always make sure to change pubkeys to lowercase.
4. change to lowercase when accepting pubkeys through endpoint url

Use https://graperank.tech/api/tests/neo4j/findDuplicates to find problem pubkeys:

8 problem pubkeys:

      {
        "pk1": "85080D3BAD70CCDCD7F74C29A44F55BB85CBCD3DD0CBB957DA1D215BDB931204", // 3 followers: 3adaacf990ec253bee5c50cae8d9a33202cd3f05fed1dee530d33a90aac52b00, 37a3b268e26b13a932fca94bff709753b02b067db0e03172a92879a346fdcd19, 60c052cf19fbfb973c1779585df423e3982a3a251fc826d4c76f8063621c5bb6
        "pk2": "85080d3bad70ccdcd7f74c29a44f55bb85cbcd3dd0cbb957da1d215bdb931204" preston
      },
      {
        "pk1": "C49D52A573366792B9A6E4851587C28042FB24FA5625C6D67B8C95C8751ACA15", // 1 follower: 3adaacf990ec253bee5c50cae8d9a33202cd3f05fed1dee530d33a90aac52b00
        "pk2": "c49d52a573366792b9a6e4851587c28042fb24fa5625c6d67b8c95c8751aca15" // hodlonaut
      },
      {
        "pk1": "E88A691E98D9987C964521DFF60025F60700378A4879180DCBBB4A5027850411", // 1 follower: 3adaacf990ec253bee5c50cae8d9a33202cd3f05fed1dee530d33a90aac52b00
        "pk2": "e88a691e98d9987c964521dff60025f60700378a4879180dcbbb4a5027850411" // NVK
      },
      {
        "pk1": "472F440F29EF996E92A186B8D320FF180C855903882E59D50DE1B8BD5669301E", // 1 follower: 3adaacf990ec253bee5c50cae8d9a33202cd3f05fed1dee530d33a90aac52b00
        "pk2": "472f440f29ef996e92a186b8d320ff180c855903882e59d50de1b8bd5669301e" // MartyBent
      },
      {
        "pk1": "C4EABAE1BE3CF657BC1855EE05E69DE9F059CB7A059227168B80B89761CBC4E0", // 2 followers: 3adaacf990ec253bee5c50cae8d9a33202cd3f05fed1dee530d33a90aac52b00, 37a3b268e26b13a932fca94bff709753b02b067db0e03172a92879a346fdcd19
        "pk2": "c4eabae1be3cf657bc1855ee05e69de9f059cb7a059227168b80b89761cbc4e0" // jack mallers
      },
      {
        "pk1": "A341F45FF9758F570A21B000C17D4E53A3A497C8397F26C0E6D61E5ACFFC7A98", // 1 follower: 3adaacf990ec253bee5c50cae8d9a33202cd3f05fed1dee530d33a90aac52b00
        "pk2": "a341f45ff9758f570a21b000c17d4e53a3a497c8397f26c0e6d61e5acffc7a98" // saylor
      },
      {
        "pk1": "3F770D65D3A764A9C5CB503AE123E62EC7598AD035D836E2A810F3877A745B24", // 2 followers: 3adaacf990ec253bee5c50cae8d9a33202cd3f05fed1dee530d33a90aac52b00, 37a3b268e26b13a932fca94bff709753b02b067db0e03172a92879a346fdcd19
        "pk2": "3f770d65d3a764a9c5cb503ae123e62ec7598ad035d836e2a810f3877a745b24" // Derek Ross
      },
      {
        "pk1": "83E818DFBECCEA56B0F551576B3FD39A7A50E1D8159343500368FA085CCD964B", // 1 follower: 3adaacf990ec253bee5c50cae8d9a33202cd3f05fed1dee530d33a90aac52b00
        "pk2": "83e818dfbeccea56b0f551576b3fd39a7a50e1d8159343500368fa085ccd964b" // Jeff Booth
      },

// for some reason, 37a3b268e26b13a932fca94bff709753b02b067db0e03172a92879a346fdcd19 (ROSE) does not show up at 
http://localhost:3000/#/profile?pubkey=37a3b268e26b13a932fca94bff709753b02b067db0e03172a92879a346fdcd19
or 
http://localhost:3000/#/profile?npub=npub1x73my68zdvf6jvhu499l7uyh2wczkpnakrsrzu4f9pu6x3hae5vsha3c34
but does show up in sql and neo4j and on master table, with GrapeRank score of 0

MATCH (n:NostrUser {pubkey:'85080D3BAD70CCDCD7F74C29A44F55BB85CBCD3DD0CBB957DA1D215BDB931204'}) RETURN n

MATCH (n:NostrUser {pubkey:'85080D3BAD70CCDCD7F74C29A44F55BB85CBCD3DD0CBB957DA1D215BDB931204'}) DETACH DELETE n // preston
MATCH (n:NostrUser {pubkey:'C49D52A573366792B9A6E4851587C28042FB24FA5625C6D67B8C95C8751ACA15'}) DETACH DELETE n // hodlonaut
MATCH (n:NostrUser {pubkey:'E88A691E98D9987C964521DFF60025F60700378A4879180DCBBB4A5027850411'}) DETACH DELETE n // NVK
MATCH (n:NostrUser {pubkey:'472F440F29EF996E92A186B8D320FF180C855903882E59D50DE1B8BD5669301E'}) DETACH DELETE n // MartyBent
MATCH (n:NostrUser {pubkey:'C4EABAE1BE3CF657BC1855EE05E69DE9F059CB7A059227168B80B89761CBC4E0'}) DETACH DELETE n // jack mallers
MATCH (n:NostrUser {pubkey:'A341F45FF9758F570A21B000C17D4E53A3A497C8397F26C0E6D61E5ACFFC7A98'}) DETACH DELETE n // saylor
MATCH (n:NostrUser {pubkey:'3F770D65D3A764A9C5CB503AE123E62EC7598AD035D836E2A810F3877A745B24'}) DETACH DELETE n // Derek Ross
MATCH (n:NostrUser {pubkey:'83E818DFBECCEA56B0F551576B3FD39A7A50E1D8159343500368FA085CCD964B'}) DETACH DELETE n // Jeff Booth

Again, 3 Jan 2025:
8 problem pubkeys:

      {
        "pk1": "85080D3BAD70CCDCD7F74C29A44F55BB85CBCD3DD0CBB957DA1D215BDB931204", // 1 follower: 3adaacf990ec253bee5c50cae8d9a33202cd3f05fed1dee530d33a90aac52b00
        "pk2": "85080d3bad70ccdcd7f74c29a44f55bb85cbcd3dd0cbb957da1d215bdb931204" preston
      },
      {
        "pk1": "C49D52A573366792B9A6E4851587C28042FB24FA5625C6D67B8C95C8751ACA15", // 1 follower: 3adaacf990ec253bee5c50cae8d9a33202cd3f05fed1dee530d33a90aac52b00
        "pk2": "c49d52a573366792b9a6e4851587c28042fb24fa5625c6d67b8c95c8751aca15" // hodlonaut
      },
      {
        "pk1": "E88A691E98D9987C964521DFF60025F60700378A4879180DCBBB4A5027850411", // 1 follower: 3adaacf990ec253bee5c50cae8d9a33202cd3f05fed1dee530d33a90aac52b00
        "pk2": "e88a691e98d9987c964521dff60025f60700378a4879180dcbbb4a5027850411" // NVK
      },
      {
        "pk1": "472F440F29EF996E92A186B8D320FF180C855903882E59D50DE1B8BD5669301E", // 1 follower: 3adaacf990ec253bee5c50cae8d9a33202cd3f05fed1dee530d33a90aac52b00
        "pk2": "472f440f29ef996e92a186b8d320ff180c855903882e59d50de1b8bd5669301e" // MartyBent
      },
      {
        "pk1": "C4EABAE1BE3CF657BC1855EE05E69DE9F059CB7A059227168B80B89761CBC4E0", // 1 follower: 3adaacf990ec253bee5c50cae8d9a33202cd3f05fed1dee530d33a90aac52b00
        "pk2": "c4eabae1be3cf657bc1855ee05e69de9f059cb7a059227168b80b89761cbc4e0" // jack mallers
      },
      {
        "pk1": "A341F45FF9758F570A21B000C17D4E53A3A497C8397F26C0E6D61E5ACFFC7A98", // 1 follower: 3adaacf990ec253bee5c50cae8d9a33202cd3f05fed1dee530d33a90aac52b00
        "pk2": "a341f45ff9758f570a21b000c17d4e53a3a497c8397f26c0e6d61e5acffc7a98" // saylor
      },
      {
        "pk1": "3F770D65D3A764A9C5CB503AE123E62EC7598AD035D836E2A810F3877A745B24", // 1 follower: 3adaacf990ec253bee5c50cae8d9a33202cd3f05fed1dee530d33a90aac52b00
        "pk2": "3f770d65d3a764a9c5cb503ae123e62ec7598ad035d836e2a810f3877a745b24" // Derek Ross
      },
      {
        "pk1": "83E818DFBECCEA56B0F551576B3FD39A7A50E1D8159343500368FA085CCD964B", // 1 follower: 3adaacf990ec253bee5c50cae8d9a33202cd3f05fed1dee530d33a90aac52b00
        "pk2": "83e818dfbeccea56b0f551576b3fd39a7a50e1d8159343500368fa085ccd964b" // Jeff Booth
      },

