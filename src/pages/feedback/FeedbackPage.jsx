import { useEffect, useState, useCallback, useMemo } from 'react';
import Topbar from '../../components/layout/Topbar.jsx';
import { PageSpinner, Spinner } from '../../components/ui/Spinner.jsx';
import { feedbackService } from '../../services/feedback.service.js';
import { eventsService } from '../../services/events.service.js';
import useAuthStore from '../../stores/useAuthStore.js';
import useToastStore from '../../stores/useToastStore.js';
import Icon from '../../components/ui/Icon.jsx';

/* ── Helpers ────────────────────────────────────────────────────────── */
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

/* ── Stars ──────────────────────────────────────────────────────────── */
function Stars({ value = 0, onChange, readonly = false, size = 18 }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="fb-stars">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= (hover || Math.round(value));
        return (
          <span
            key={n}
            className={filled ? 'fb-stars__star' : 'fb-stars__star--empty'}
            style={{ cursor: readonly ? 'default' : 'pointer', display: 'inline-flex', transition: 'color 0.1s' }}
            onClick={() => !readonly && onChange?.(n)}
            onMouseEnter={() => !readonly && setHover(n)}
            onMouseLeave={() => !readonly && setHover(0)}
          >
            <Icon name={filled ? 'starFilled' : 'star'} size={size} strokeWidth={1.4} />
          </span>
        );
      })}
    </div>
  );
}

/* ── Avatar ─────────────────────────────────────────────────────────── */
function Avatar({ name, photoUrl, size = 40, fontSize = 15 }) {
  return (
    <div className="fb-rating-avatar" style={{ width: size, height: size, fontSize }}>
      {photoUrl ? <img src={photoUrl} alt={name} /> : initials(name)}
    </div>
  );
}

/* ── Score ring ─────────────────────────────────────────────────────── */
function ScoreRing({ avg, total }) {
  const r = 38;
  const circ = 2 * Math.PI * r;
  return (
    <div className="fb-score-ring">
      <svg className="fb-score-ring__svg" viewBox="0 0 96 96">
        <defs>
          <linearGradient id="fb-ring-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
        <circle className="fb-score-ring__track" cx="48" cy="48" r={r} />
        <circle className="fb-score-ring__fill" cx="48" cy="48" r={r}
          strokeDasharray={circ} strokeDashoffset={total > 0 ? circ - (avg / 5) * circ : circ} />
      </svg>
      <div className="fb-score-ring__inner">
        <span className="fb-score-ring__val">{total > 0 ? avg : '—'}</span>
        <span className="fb-score-ring__max">/ 5</span>
      </div>
    </div>
  );
}

/* ── Received rating card ───────────────────────────────────────────── */
function RatingFeedCard({ rating }) {
  const score = rating.rating || rating.score || 0;
  const name = rating.rated_by_name || rating.rater_name || rating.full_name || 'Anonymous';
  return (
    <div className="fb-rating-card">
      <Avatar name={name} photoUrl={rating.photo_url} />
      <div className="fb-rating-body">
        <div className="fb-rating-name">{name}</div>
        <div className="fb-rating-sub">
          {rating.event_title && <span>{rating.event_title}</span>}
          <span style={{ color: 'rgba(15,23,42,0.15)' }}>·</span>
          <span>{fmtDate(rating.created_at)}</span>
        </div>
        {rating.comment && <div className="fb-rating-comment">"{rating.comment}"</div>}
      </div>
      <div className="fb-rating-right">
        <Stars value={score} readonly size={15} />
        <span className="fb-score-pill"><Icon name="starFilled" size={11} /> {score}/5</span>
      </div>
    </div>
  );
}

/* ── Leaderboard ─────────────────────────────────────────────────────── */
function LbPodiumItem({ rank, item }) {
  const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
  const rankLabel = { 1: '1st', 2: '2nd', 3: '3rd' };

  if (!item) {
    return (
      <div className={`fb-lb-podium-item fb-lb-podium-item--${rank}`}>
        <div className="fb-lb-podium-medal" style={{ opacity: 0.25 }}>{medals[rank]}</div>
        <div className="fb-lb-podium-avatar" style={{ opacity: 0.18, background: 'rgba(15,23,42,0.08)', border: '2px dashed rgba(15,23,42,0.15)' }}>
          <span style={{ fontSize: rank === 1 ? 20 : 16, color: 'rgba(15,23,42,0.3)' }}>{rankLabel[rank]}</span>
        </div>
        <div className="fb-lb-podium-name" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>—</div>
        <div className="fb-lb-podium-score" style={{ color: 'var(--text-muted)' }}>—</div>
        <div className="fb-lb-podium-block" style={{ opacity: 0.18 }} />
      </div>
    );
  }

  const words = (item.full_name || 'Unknown').split(' ');
  const displayName = words.length >= 2 ? `${words[0]} ${words[1]}` : words[0];

  return (
    <div className={`fb-lb-podium-item fb-lb-podium-item--${rank}`}>
      <div className="fb-lb-podium-medal">{medals[rank]}</div>
      <div className="fb-lb-podium-avatar">
        {item.photo_url ? <img src={item.photo_url} alt={item.full_name} /> : initials(item.full_name)}
      </div>
      <div className="fb-lb-podium-name">{displayName}</div>
      <div className="fb-lb-podium-score">{parseFloat(item.avg_rating).toFixed(1)}</div>
      <div className="fb-lb-podium-block" />
    </div>
  );
}

function LbRow({ rank, item }) {
  return (
    <div className="fb-lb-row">
      <div className="fb-lb-rank">{rank}</div>
      <div className="fb-lb-avatar">
        {item.photo_url ? <img src={item.photo_url} alt={item.full_name} /> : initials(item.full_name)}
      </div>
      <div className="fb-lb-info">
        <div className="fb-lb-name">{item.full_name || 'Unknown'}</div>
        <div className="fb-lb-dept">{item.department || item.batch || 'Volunteer'}</div>
        <div className="fb-lb-bar">
          <div className="fb-lb-bar__fill" style={{ width: `${(item.avg_rating / 5) * 100}%` }} />
        </div>
      </div>
      <div className="fb-lb-score">
        <div className="fb-lb-score__val">{item.avg_rating}</div>
        <div className="fb-lb-score__count">{item.total_ratings}×</div>
      </div>
    </div>
  );
}

function Leaderboard({ data, currentUserId }) {
  const podium = data.slice(0, 3);
  const rest = data.slice(3);
  const myRank = currentUserId ? data.findIndex((d) => d.volunteer_id === currentUserId) + 1 : 0;
  return (
    <div className="fb-lb">
      <div className="fb-lb-header">
        <div className="fb-lb-header__icon">🏆</div>
        <div>
          <div className="fb-lb-header__title">Volunteer Leaderboard</div>
          <div className="fb-lb-header__sub">
            {myRank > 0 ? `You're ranked #${myRank} on campus` : 'Top rated volunteers on campus'}
          </div>
        </div>
      </div>
      {data.length === 0 ? (
        <div className="fb-lb-empty">No volunteer ratings yet.</div>
      ) : (
        <>
          <div className="fb-lb-podium">
            {[1, 2, 0].map((idx) => (
              <LbPodiumItem key={idx} rank={idx + 1} item={podium[idx] ?? null} />
            ))}
          </div>
          <div className="fb-lb-divider" />
          {rest.length > 0 && (
            <div className="fb-lb-list">
              {rest.map((item, i) => <LbRow key={item.volunteer_id} rank={i + 4} item={item} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Volunteer card ──────────────────────────────────────────────────── */
function VolunteerCard({ volunteer, onRate, roleName }) {
  const hasRating = volunteer.total_ratings > 0;
  return (
    <div className="fb-vol-card">
      <div className="fb-vol-card__avatar">
        {volunteer.photo_url ? <img src={volunteer.photo_url} alt={volunteer.full_name} /> : initials(volunteer.full_name)}
      </div>
      <div className="fb-vol-card__name">{volunteer.full_name || 'Unknown'}</div>
      {(volunteer.department || roleName || volunteer.role_name) && (
        <div className="fb-vol-card__dept">{roleName || volunteer.role_name || volunteer.department}</div>
      )}
      {hasRating ? (
        <div className="fb-vol-card__stars">
          <Stars value={volunteer.avg_rating} readonly size={13} />
          <span className="fb-vol-card__score">{volunteer.avg_rating}</span>
        </div>
      ) : (
        <div className="fb-vol-card__no-rating">Not yet rated</div>
      )}
      <div className="fb-vol-card__meta">
        {volunteer.events_count > 0 ? `${volunteer.events_count} event${volunteer.events_count !== 1 ? 's' : ''}` : 'No events yet'}
        {hasRating && ` · ${volunteer.total_ratings} rating${volunteer.total_ratings !== 1 ? 's' : ''}`}
      </div>
      <button className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={() => onRate(volunteer)}>
        <Icon name="starFilled" size={13} /> Rate Volunteer
      </button>
    </div>
  );
}

/* ── Rate volunteer modal ─────────────────────────────────────────────── */
function RateVolunteerModal({ volunteer, onClose, onSuccess }) {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    feedbackService.getVolunteerRatableEvents(volunteer.id)
      .then((data) => setEvents(Array.isArray(data) ? data : data?.data || []))
      .catch(() => setEvents([]))
      .finally(() => setLoadingEvents(false));
  }, [volunteer.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEvent) { useToastStore.getState().error('Please select an event.'); return; }
    if (!rating) { useToastStore.getState().error('Please give a star rating.'); return; }
    setSaving(true);
    try {
      await feedbackService.rateVolunteer(selectedEvent, volunteer.id, { rating, comment: comment.trim() || undefined });
      useToastStore.getState().success('Rating submitted!');
      onSuccess?.();
      onClose();
    } catch (err) {
      useToastStore.getState().error(err.response?.data?.message || 'Failed to submit rating.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="card-header">
          <div className="card-title">Rate Volunteer</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0 18px', borderBottom: '1px solid var(--border-subtle)', marginBottom: 18 }}>
          <div className="fb-vol-card__avatar" style={{ width: 46, height: 46, fontSize: 16 }}>
            {volunteer.photo_url ? <img src={volunteer.photo_url} alt={volunteer.full_name} /> : initials(volunteer.full_name)}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{volunteer.full_name}</div>
            {volunteer.department && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{volunteer.department}</div>}
          </div>
          {volunteer.avg_rating > 0 && (
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <Stars value={volunteer.avg_rating} readonly size={13} />
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{volunteer.avg_rating} avg</div>
            </div>
          )}
        </div>
        {loadingEvents ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><Spinner size="sm" /></div>
        ) : events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: 14 }}>
            No shared completed events found to rate this volunteer.
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="input-wrap">
              <label className="input-label">Select Event</label>
              <select className="input-field" value={selectedEvent} onChange={(e) => setSelectedEvent(e.target.value)}>
                <option value="">Choose an event…</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>{ev.title} — {fmtDate(ev.start_date)}</option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>Your Rating</div>
              <Stars value={rating} onChange={setRating} size={26} />
            </div>
            <div className="input-wrap">
              <label className="input-label">Comment (optional)</label>
              <textarea className="textarea-field" rows={3} placeholder="How did this volunteer perform?" value={comment} onChange={(e) => setComment(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving || !selectedEvent || !rating}>
                {saving ? <><Spinner size="sm" /> Submitting…</> : 'Submit Rating'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* ── Submit event feedback modal ──────────────────────────────────────── */
function SubmitEventFeedbackModal({ event, onClose }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rating) { useToastStore.getState().error('Please select a star rating.'); return; }
    setSaving(true);
    try {
      await feedbackService.submitEventFeedback(event.id, { rating, comment: comment.trim() || undefined });
      useToastStore.getState().success('Feedback submitted!');
      onClose();
    } catch (err) {
      useToastStore.getState().error(err.response?.data?.message || 'Failed to submit feedback.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="card-header">
          <div className="card-title">Rate Event</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{ marginBottom: 16, color: 'var(--text-muted)', fontSize: 14 }}>{event?.title}</div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>Your Rating</div>
            <Stars value={rating} onChange={setRating} size={26} />
          </div>
          <div className="input-wrap">
            <label className="input-label">Comment (optional)</label>
            <textarea className="textarea-field" rows={3} placeholder="Share your experience…" value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? <><Spinner size="sm" /> Submitting…</> : 'Submit Feedback'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Volunteer section with full filter / search / view-mode ────────── */
function VolunteersSection({ allVolunteers, pastEvents, onRate, onReload }) {
  const [viewMode, setViewMode] = useState('all');          // 'all' | 'by-event'
  const [selectedEvent, setSelectedEvent] = useState(null); // event object
  const [eventVolunteers, setEventVolunteers] = useState([]);
  const [loadingEv, setLoadingEv] = useState(false);

  // toolbar state
  const [search, setSearch]         = useState('');
  const [sortBy, setSortBy]         = useState('rating_desc');
  const [filterDept, setFilterDept] = useState('');
  const [filterRated, setFilterRated] = useState('all');

  // departments from all volunteers
  const departments = useMemo(
    () => [...new Set(allVolunteers.map((v) => v.department).filter(Boolean))].sort(),
    [allVolunteers]
  );

  const handleSelectEvent = useCallback(async (evt) => {
    setSelectedEvent(evt);
    setLoadingEv(true);
    try {
      const data = await feedbackService.getEventVolunteers(evt.id);
      setEventVolunteers(Array.isArray(data) ? data : data?.data || []);
    } catch {
      useToastStore.getState().error('Failed to load volunteers for this event.');
      setEventVolunteers([]);
    } finally {
      setLoadingEv(false);
    }
  }, []);

  const handleBackToEvents = () => setSelectedEvent(null);

  const handleViewMode = (mode) => {
    setViewMode(mode);
    setSelectedEvent(null);
    setEventVolunteers([]);
    setSearch('');
  };

  // source depends on view mode
  const source = viewMode === 'by-event' && selectedEvent ? eventVolunteers : allVolunteers;

  // apply search + filter + sort
  const filtered = useMemo(() => {
    let list = source;
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((v) => (v.full_name || '').toLowerCase().includes(q));
    if (filterDept) list = list.filter((v) => v.department === filterDept);
    if (filterRated === 'rated')   list = list.filter((v) => v.total_ratings > 0);
    if (filterRated === 'unrated') list = list.filter((v) => !v.total_ratings);
    return [...list].sort((a, b) => {
      if (sortBy === 'rating_desc') return (b.avg_rating || 0) - (a.avg_rating || 0);
      if (sortBy === 'rating_asc')  return (a.avg_rating || 0) - (b.avg_rating || 0);
      if (sortBy === 'name')        return (a.full_name || '').localeCompare(b.full_name || '');
      if (sortBy === 'events')      return (b.events_count || 0) - (a.events_count || 0);
      return 0;
    });
  }, [source, search, filterDept, filterRated, sortBy]);

  const hasActiveFilters = search || filterDept || filterRated !== 'all';

  const clearFilter = (key) => {
    if (key === 'search') setSearch('');
    if (key === 'dept') setFilterDept('');
    if (key === 'rated') setFilterRated('all');
  };

  const showGrid = viewMode === 'all' || (viewMode === 'by-event' && selectedEvent);

  return (
    <div className="fb-section">
      {/* Section header */}
      <div className="fb-section-head">
        <div className="fb-section-title">
          <div className="fb-section-bar" />
          Volunteers
        </div>
        <div style={{ display: 'flex', align: 'center', gap: 10 }}>
          <div className="fb-count-badge">{filtered.length}</div>
        </div>
      </div>

      {/* View mode tabs */}
      <div style={{ padding: '12px 18px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="fb-view-tabs">
          <button className={`fb-view-tab${viewMode === 'all' ? ' is-active' : ''}`} onClick={() => handleViewMode('all')}>
            <Icon name="users" size={13} /> All Volunteers
          </button>
          <button className={`fb-view-tab${viewMode === 'by-event' ? ' is-active' : ''}`} onClick={() => handleViewMode('by-event')}>
            <Icon name="calendar" size={13} /> By Event
          </button>
        </div>
      </div>

      {/* Show event list in by-event mode (no event selected yet) */}
      {viewMode === 'by-event' && !selectedEvent && (
        <>
          {pastEvents.length === 0 ? (
            <div className="fb-empty">
              <div className="fb-empty__icon"><Icon name="calendar" size={22} /></div>
              <div className="fb-empty__title">No completed events</div>
              <div className="fb-empty__sub">Completed events with volunteers will appear here.</div>
            </div>
          ) : (
            <div className="fb-event-cards">
              {pastEvents.map((evt) => (
                <div key={evt.id} className="fb-event-card" onClick={() => handleSelectEvent(evt)}>
                  <div className="fb-event-card__icon"><Icon name="calendar" size={18} /></div>
                  <div className="fb-event-card__body">
                    <div className="fb-event-card__title">{evt.title}</div>
                    <div className="fb-event-card__meta">
                      <span>{fmtDate(evt.start_date)}</span>
                      {evt.venue && <><span>·</span><span>{evt.venue}</span></>}
                    </div>
                  </div>
                  <div className="fb-event-card__vol-badge">
                    <Icon name="users" size={11} /> volunteers
                  </div>
                  <div className="fb-event-card__arrow"><Icon name="arrowRight" size={16} /></div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Toolbar — shown when displaying a volunteer grid */}
      {showGrid && (
        <div className="fb-toolbar">
          <div className="fb-toolbar__search">
            <div className="fb-toolbar__search-icon"><Icon name="search" size={14} /></div>
            <input
              type="text"
              placeholder="Search volunteers…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="fb-toolbar__select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="rating_desc">Highest Rated</option>
            <option value="rating_asc">Lowest Rated</option>
            <option value="name">Name A–Z</option>
            <option value="events">Most Events</option>
          </select>
          {departments.length > 0 && (
            <select className="fb-toolbar__select" value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
              <option value="">All Departments</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
          <select className="fb-toolbar__select" value={filterRated} onChange={(e) => setFilterRated(e.target.value)}>
            <option value="all">All Ratings</option>
            <option value="rated">Rated Only</option>
            <option value="unrated">Not Yet Rated</option>
          </select>
        </div>
      )}

      {/* Results bar — back button + active filters + count */}
      {showGrid && (viewMode === 'by-event' || hasActiveFilters) && (
        <div className="fb-results-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {viewMode === 'by-event' && selectedEvent && (
              <button className="fb-results-bar__back" onClick={handleBackToEvents}>
                <Icon name="arrowLeft" size={14} /> Back
              </button>
            )}
            {viewMode === 'by-event' && selectedEvent && (
              <span className="fb-results-bar__event">{selectedEvent.title}</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {hasActiveFilters && (
              <div className="fb-active-filters">
                {search && (
                  <span className="fb-filter-chip">
                    "{search}" <button onClick={() => clearFilter('search')}>×</button>
                  </span>
                )}
                {filterDept && (
                  <span className="fb-filter-chip">
                    {filterDept} <button onClick={() => clearFilter('dept')}>×</button>
                  </span>
                )}
                {filterRated !== 'all' && (
                  <span className="fb-filter-chip">
                    {filterRated === 'rated' ? 'Rated only' : 'Not rated'} <button onClick={() => clearFilter('rated')}>×</button>
                  </span>
                )}
              </div>
            )}
            <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {filtered.length} volunteer{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}

      {/* Loading event volunteers */}
      {viewMode === 'by-event' && selectedEvent && loadingEv && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><Spinner size="sm" /></div>
      )}

      {/* Volunteer grid */}
      {showGrid && !loadingEv && (
        filtered.length === 0 ? (
          <div className="fb-no-results">
            <Icon name="search" size={28} />
            <div style={{ fontWeight: 600, color: 'var(--text-default)', marginTop: 4 }}>No volunteers found</div>
            <div style={{ fontSize: 13 }}>Try adjusting your search or filters.</div>
          </div>
        ) : (
          <div className="fb-vol-grid">
            {filtered.map((v) => (
              <VolunteerCard key={v.id} volunteer={v} onRate={onRate} roleName={v.role_name} />
            ))}
          </div>
        )
      )}
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────── */
export default function FeedbackPage() {
  const { user } = useAuthStore();
  const role = user?.role;

  const isVolunteer = role === 'VOLUNTEER';

  const [myRatings, setMyRatings]     = useState([]);
  const [avgRating, setAvgRating]     = useState(0);
  const [pastEvents, setPastEvents]   = useState([]);
  const [volunteers, setVolunteers]   = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading]         = useState(true);

  const [ratingVolunteer, setRatingVolunteer] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (isVolunteer) {
        const [lbRes, ratingsRes] = await Promise.allSettled([
          feedbackService.getLeaderboard(10),
          feedbackService.getMyVolunteerRatings(),
        ]);
        setLeaderboard(lbRes.status === 'fulfilled' ? (Array.isArray(lbRes.value) ? lbRes.value : lbRes.value?.data || []) : []);
        if (ratingsRes.status === 'fulfilled') {
          const v = ratingsRes.value;
          const inner = v?.data ?? v;
          setMyRatings(Array.isArray(inner) ? inner : inner?.ratings || []);
          setAvgRating(inner?.avgRating || 0);
        }
      } else {
        const [lbRes, volRes, evtRes] = await Promise.allSettled([
          feedbackService.getLeaderboard(10),
          feedbackService.listVolunteers(),
          eventsService.listEvents({ status: 'completed', limit: 50, page: 1 }),
        ]);
        setLeaderboard(lbRes.status === 'fulfilled' ? (Array.isArray(lbRes.value) ? lbRes.value : lbRes.value?.data || []) : []);
        if (volRes.status === 'fulfilled') {
          const v = volRes.value;
          setVolunteers(Array.isArray(v) ? v : v?.data || []);
        }
        if (evtRes.status === 'fulfilled') {
          const e = evtRes.value;
          setPastEvents(Array.isArray(e) ? e : e?.events || e?.data || []);
        }
      }
    } catch {
      useToastStore.getState().error('Failed to load feedback data.');
    } finally {
      setLoading(false);
    }
  }, [isVolunteer]);

  useEffect(() => { load(); }, [load]);

  /* ── VOLUNTEER view ──────────────────────────────────────────────── */
  if (isVolunteer) {
    return (
      <>
        <Topbar />
        <div className="page-content">
          <div className="page-header">
            <div>
              <div className="page-title">My Feedback &amp; Ratings</div>
              <div className="page-subtitle">Your volunteer performance and campus ranking</div>
            </div>
          </div>
          {loading ? <PageSpinner /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              <div className="fb-hero">
                <ScoreRing avg={avgRating} total={myRatings.length} />
                <div className="fb-hero__info">
                  <div className="fb-hero__label">Volunteer Score</div>
                  <div className="fb-hero__title">
                    {myRatings.length === 0 ? 'No ratings yet'
                      : avgRating >= 4.5 ? 'Outstanding performance!'
                      : avgRating >= 4.0 ? 'Great work!'
                      : avgRating >= 3.0 ? 'Good standing'
                      : 'Keep improving'}
                  </div>
                  <div className="fb-hero__chips">
                    <div className="fb-hero__chip">
                      <div className="fb-hero__chip-icon"><Icon name="starFilled" size={12} /></div>
                      <strong>{avgRating > 0 ? avgRating.toFixed(1) : '—'}</strong>
                      <span>avg rating</span>
                    </div>
                    <div className="fb-hero__chip">
                      <div className="fb-hero__chip-icon"><Icon name="users" size={12} /></div>
                      <strong>{myRatings.length}</strong>
                      <span>{myRatings.length === 1 ? 'review' : 'reviews'}</span>
                    </div>
                    <div className="fb-hero__chip">
                      <div className="fb-hero__chip-icon"><Icon name="calendar" size={12} /></div>
                      <strong>{[...new Set(myRatings.map((r) => r.event_id).filter(Boolean))].length}</strong>
                      <span>events</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="fb-grid">
                <div className="fb-main">
                  <div className="fb-section">
                    <div className="fb-section-head">
                      <div className="fb-section-title"><div className="fb-section-bar" />Received Ratings</div>
                      <div className="fb-count-badge">{myRatings.length}</div>
                    </div>
                    {myRatings.length === 0 ? (
                      <div className="fb-empty">
                        <div className="fb-empty__icon"><Icon name="award" size={22} /></div>
                        <div className="fb-empty__title">No ratings yet</div>
                        <div className="fb-empty__sub">Participate in events and organizers will rate you here.</div>
                      </div>
                    ) : (
                      <div className="fb-ratings-list">
                        {myRatings.map((r, i) => <RatingFeedCard key={r.id || i} rating={r} />)}
                      </div>
                    )}
                  </div>
                </div>
                <div><Leaderboard data={leaderboard} currentUserId={user?.id} /></div>
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  /* ── ORGANIZER / ADMIN / ATTENDEE view ───────────────────────────── */
  const subtitle =
    role === 'ORGANIZER' ? 'Rate volunteers and browse event feedback' :
    role === 'ATTENDEE'  ? 'Rate volunteers and events you attended' :
    'Manage event feedback and volunteer ratings';

  return (
    <>
      <Topbar />
      <div className="page-content">
        <div className="page-header">
          <div>
            <div className="page-title">Feedback &amp; Ratings</div>
            <div className="page-subtitle">{subtitle}</div>
          </div>
        </div>

        {loading ? <PageSpinner /> : (
          <div className="fb-grid" style={{ alignItems: 'start' }}>
            {/* Left column */}
            <div className="fb-main">
              <VolunteersSection
                allVolunteers={volunteers}
                pastEvents={pastEvents}
                onRate={setRatingVolunteer}
                onReload={load}
              />
            </div>

            {/* Leaderboard sidebar */}
            <div><Leaderboard data={leaderboard} currentUserId={null} /></div>
          </div>
        )}
      </div>

      {ratingVolunteer && (
        <RateVolunteerModal volunteer={ratingVolunteer} onClose={() => setRatingVolunteer(null)} onSuccess={load} />
      )}
    </>
  );
}
