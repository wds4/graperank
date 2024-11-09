# GrapeRank

Purpose of this repo is to repeat the functionality of `interpretation-brainstorm.vercel.app` and `calculation-brainstorm.vercel.app` but with improved performance by moving from vercel to AWS ec2, which scales, and using neo4j as the core database. An API will be exposed for communication with the grapevine front end, similar to what is already functional at `grapevine-brainstorm.vercel.app`. 

An API will also be exposed for communication with nostr clients such as Coracle which will return grapevine data. 
- Goal 1: We may submit a nostr client PR so that grapevine customers can activate a funcionality in settings that will show the DoS and GrapeRank WoT Score on individual profile pages, if such data is available over an API to graperank.tech.
- Goal 2: Expose an API that provides a list of Recommended Pubkeys that can be used in place of follows for the main content feed. Especially useful for new nostr users with only a handful of follows.
- Goal 3 - less well defined: Expose one or more APIs that output a list of GrapeRank WoT Scores which can be used to stratify content, similar to PageRank in keyword search.

This will be a grapevine interpretation and calculation engine merged together.  Will use an AWS ec2 instance that will connect to nostr relays, keep channels open, and maintain a neo4j database of follows and mutes. Will later add reports and other event kinds. 

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

following https://dev.to/j3rry320/deploy-your-nextjs-app-like-a-pro-a-step-by-step-guide-using-nginx-pm2-certbot-and-git-on-your-linux-server-3286:

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
java -version
sudo nano /etc/neo4j/neo4j.conf
(make 3 changes to file)
sudo service neo4j restart
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

Currently http://52.91.115.172 directs to nginx landing page (bc /etc/nginx/sites-available/default) and https:/graperank.tech shows nextjs landing page

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

locally:

```
npm install nostr-tools
npm install @nostr-dev-kit/ndk 
npm install @noble/hashes
```

## TODO:
- maybe get rid of nginx landing page (delete /etc/nginx/sites-available/default?)
- add basic nostr functioning
- add s3 bucket functionality
- add mysql functionality 


