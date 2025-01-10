import { read } from '@/lib/neo4j'

const pubkey1 = `e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f`

console.log('Node.js test_script_neo4j.mjs executed!');

const cypher1 = `MATCH (n:NostrUser {pubkey: '${pubkey1}'})<-[:FOLLOWS]-(m:NostrUser) RETURN count(m) as numFollowers ` // cypher command 
const result1  = await read(cypher1, {})
// const aResult1 = JSON.parse(JSON.stringify(result1))

console.log(`result1: ${JSON.stringify(result1)}`)

console.log('end of test_script_neo4j!!');
