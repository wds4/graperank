type context = string
type pubkey = string
type score = number // can refer to a rating as a primary data point or to an average of ratings, so may be referred to as rating, average, or averageScore. min, max depend on the use case (0-1 for notSpam; 0-5 for 5stars or products; may be negative in some use cases). 
// type input = number // nonzero, no upper bound
type confidence = number // [0, 1]; can be de novo (rating) or calculated from input (scorecard)
// type influence = number // score * confidence; useful if observee can play the role of a rater or observer at a future step; may be defined differently for other use cases (e.g. 5 star ratings)
// type weights = number // sum of weights; used as running score during calculations
// type products = number // sum of products

export type rater = pubkey | number
export type ratee = pubkey | number
export type observer = pubkey | number
export type observee = pubkey | number

// Scorecards Version 0: aScoreAndConfidence (SAME AS RATINGS TABLE)
type aScoreAndConfidence = [score, confidence]

type ObserveeObjectV0 = {
    [key: observee]: aScoreAndConfidence
}
export type ObserverObjectV0 = {
    [key: observer]: ObserveeObjectV0
}
export type ScorecardsV0 = {
    [key: context]: ObserverObjectV0
}

// Most compact format, using two strategies:
// use ids instead of pubkeys (where available)
export type ObserveeObjectV0Compact = {
    [key: observee]: string
}
export type ObserverObjectV0Compact = {
    [key: observer]: ObserveeObjectV0Compact
}

export const observerObjectExample:ObserverObjectV0Compact = {
    1: {
        2: 'f',
        3: 'f',
        99: 'm',
    },
    2: {
        'pubkey123abc': 'm'
    },
    3: {
        1: 'f',
        99: 'm'
    },
    'pubkey123abc': {
        99: 'f'
    }
}
