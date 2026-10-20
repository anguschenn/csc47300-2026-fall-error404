import test from 'node:test'
import assert from 'node:assert/strict'
import { filterCommuteTrips, getTripStatus, isMyTrip } from '../src/lib/commuteTrips.ts'

const start = '2026-10-20T14:00:00Z'
const end = '2026-10-20T14:15:00Z'
const now = Date.parse('2026-10-20T13:00:00Z')
function trip(id, changes = {}) {
  return { id, creator: { id: 'alex', display_name: 'Alex' }, train_line: '6',
    departure_station: { id: 'A', name: 'First station' }, destination_station: { id: 'B', name: 'Second station' },
    meetup_at: start, meetup_end_at: end, cancelled_at: null, status: 'upcoming', participants: [], ...changes }
}
const all = { status: 'upcoming', myTripsOnly: false, line: '', departureStationId: '' }

test('status changes at both window boundaries; cancellation takes precedence', () => {
  const item = trip('one')
  assert.equal(getTripStatus(item, Date.parse(start) - 1), 'upcoming')
  assert.equal(getTripStatus(item, Date.parse(start)), 'meeting_now')
  assert.equal(getTripStatus(item, Date.parse(end)), 'completed')
  assert.equal(getTripStatus({ ...item, cancelled_at: start }, Date.parse(end)), 'cancelled')
})

test('My trips includes the creator even after leaving, and riders who joined', () => {
  const created = trip('created')
  const joined = trip('joined', { creator: { id: 'sam' }, participants: [{ id: 'alex' }] })
  const unrelated = trip('other', { creator: { id: 'sam' } })
  assert.equal(isMyTrip(created, 'alex'), true)
  assert.equal(isMyTrip(joined, 'alex'), true)
  assert.equal(isMyTrip(unrelated, 'alex'), false)
  assert.equal(isMyTrip(created, undefined), false)
  assert.deepEqual(filterCommuteTrips([created, joined, unrelated], { ...all, myTripsOnly: true }, 'alex', now).map(t => t.id), ['created', 'joined'])
})

test('status, ownership, train line, and departure filters combine', () => {
  const items = [trip('match'), trip('different-line', { train_line: '4' }),
    trip('different-stop', { departure_station: { id: 'C' } }),
    trip('not-mine', { creator: { id: 'sam' } }), trip('cancelled', { cancelled_at: start })]
  const filters = { ...all, myTripsOnly: true, line: '6', departureStationId: 'A' }
  assert.deepEqual(filterCommuteTrips(items, filters, 'alex', now).map(t => t.id), ['match'])
  assert.deepEqual(filterCommuteTrips(items, { ...filters, departureStationId: 'missing' }, 'alex', now), [])
})

test('completed trips remain available, newest first, without changing the original list', () => {
  const items = [trip('older', { meetup_at: '2026-10-19T10:00:00Z', meetup_end_at: '2026-10-19T10:15:00Z' }),
    trip('newer', { meetup_at: '2026-10-20T10:00:00Z', meetup_end_at: '2026-10-20T10:15:00Z' })]
  assert.deepEqual(filterCommuteTrips(items, { ...all, status: 'completed' }, 'alex', now).map(t => t.id), ['newer', 'older'])
  assert.deepEqual(items.map(t => t.id), ['older', 'newer'])
})
