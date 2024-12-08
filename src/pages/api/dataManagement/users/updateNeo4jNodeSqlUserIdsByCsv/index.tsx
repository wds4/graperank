import type { NextApiRequest, NextApiResponse } from 'next'
import { write } from '@/lib/neo4j'

/*
- cypher1: access https://graperank.tech/api/neo4j/generateCsv/fromEntireUsersSqlTable and execute via csv import

usage:

https://www.graperank.tech/api/dataManagement/users/updateNeo4jNodeSqlUserIdsByCsv

*/

type ResponseData = {
  success: boolean,
  message: string,
  data?: object,
}
 
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {

  try {
    const cypher1 = `LOAD CSV FROM 'https://graperank.tech/api/neo4j/generateCsv/fromEntireUsersSqlTable'
    AS row
    MERGE (n:NostrUser {pubkey: row[1], sqluserid: row[2]})
    `
    const cypher1_result = await write(cypher1, {})
    console.log(`result: ${JSON.stringify(cypher1_result)}`)

    const response:ResponseData = {
      success: true,
      message: `api/dataManagement/users/updateNeo4jNodeSqlUserIdsByCsv data:`,
      data: {
        cypher1_result
      }
    }
    res.status(200).json(response)
  } catch (error) {
    // error handling.
    console.log(`error: ${JSON.stringify(error)}`)
    const response:ResponseData = {
      success: false,
      message: `api/dataManagement/users/updateNeo4jNodeSqlUserIdsByCsv error: ${error}!`,
    }
    res.status(500).json(response)
  } finally {
    // finally.
  }
}