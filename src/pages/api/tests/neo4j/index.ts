import type { NextApiRequest, NextApiResponse } from 'next'
import { int } from 'neo4j-driver'
import { read } from '../../../../lib/neo4j'
/*
to access:
http://localhost:3000/api/tests/neo4j
https://interpretation-brainstorm.vercel.app/api/tests/neo4j
*/

interface MovieResult {
  count: string;
  movie: Movie;
}

interface Movie {
  tmdbId: string;
  title: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{total: number, data: Movie[]}>
) {

  const result = await read(`MATCH (tom:Person {name: "Tom Hanks"}) RETURN tom`, {})
  console.log(`result: ${JSON.stringify(result)}`)

  res.status(200).json(result)
}

/*
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{total: number, data: Movie[]}>
) {
  const { name  } = req.query
  const limit = parseInt(req.query.limit as string ?? '10')
  const page = parseInt(req.query.page as string ?? '1')
  const skip = (page - 1) * limit

  const result = await read<MovieResult>(`
    MATCH (m:Movie)-[:IN_GENRE]->(g:Genre {})
    RETURN
      g { .* } AS genre,
      toString(COUNT{(g)<-[:IN_GENRE]-()}) AS count,
      m {
        .tmdbId,
        .title
      } AS movie
  `, {
      genre: name,
      limit: int(limit),
      skip: int(skip)
  })
  console.log(`result: ${JSON.stringify(result)}`)

  res.status(200).json({
    total: parseInt(result[0]?.count) || 0,
    data: result.map(record => record.movie)
  })
}
*/


/*
type ResponseData = {
  message: string
}
 
export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  res.status(200).json({ message: 'Hello from Next.js! This is the neo4j test page.' })
}
*/
