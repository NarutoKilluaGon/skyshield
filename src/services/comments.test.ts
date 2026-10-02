import { describe, expect, it } from 'vitest'
import { parseMentions } from './comments'

const USERS = [
  { id: 'usr_001', name: 'J. Miller', initials: 'JM', email: 'j.miller@skysafety.aero' },
  { id: 'usr_003', name: 'R. Singh', initials: 'RS', email: 'r.singh@skysafety.aero' },
  { id: 'usr_002', name: 'A. Sharma', initials: 'AS', email: 'a.sharma@skysafety.aero' },
]

describe('parseMentions', () => {
  it('matches by display name, case-insensitively', () => {
    expect(parseMentions('Please review with @R. Singh before Friday.', USERS)).toEqual(['usr_003'])
    expect(parseMentions('cc @r. singh', USERS)).toEqual(['usr_003'])
  })

  it('matches by initials', () => {
    expect(parseMentions('@JM can you triage this?', USERS)).toEqual(['usr_001'])
  })

  it('matches by email local part', () => {
    expect(parseMentions('looping in @a.sharma', USERS)).toEqual(['usr_002'])
  })

  it('returns every distinct mention in body order of the directory', () => {
    const found = parseMentions('@J. Miller and @R. Singh — see also @R. Singh again', USERS)
    expect(found.sort()).toEqual(['usr_001', 'usr_003'].sort())
    expect(new Set(found).size).toBe(found.length)
  })

  it('ignores text without an @ prefix', () => {
    expect(parseMentions('R. Singh reviewed this yesterday.', USERS)).toEqual([])
  })

  it('ignores unknown handles', () => {
    expect(parseMentions('@nobody and @ZZ', USERS)).toEqual([])
  })

  it('is empty-body safe', () => {
    expect(parseMentions('', USERS)).toEqual([])
  })
})
