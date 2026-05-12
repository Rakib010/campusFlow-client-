import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Topbar from '../../components/layout/Topbar.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Icon from '../../components/ui/Icon.jsx';
import Countdown from '../../components/ui/Countdown.jsx';
import { PageSpinner } from '../../components/ui/Spinner.jsx';
import Modal, { ConfirmModal } from '../../components/ui/Modal.jsx';
import { eventsService } from '../../services/events.service.js';
import { usersService } from '../../services/users.service.js';
import { volunteersService } from '../../services/volunteers.service.js';
import { ticketsService } from '../../services/tickets.service.js';
import { paymentMethodsService, PAYMENT_METHOD_TYPES } from '../../services/paymentMethods.service.js';
import { feedbackService } from '../../services/feedback.service.js';
import StarRating from '../../components/ui/StarRating.jsx';
import useAuthStore from '../../stores/useAuthStore.js';
import useToastStore from '../../stores/useToastStore.js';

const STATUS_FLOW = { draft: 'published', published: 'ongoing', ongoing: 'completed' };
const CAN_MANAGE = ['ORGANIZER', 'ADMIN', 'SUPER_ADMIN'];

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}


const STATUS_COLOR = {
  draft: 'amber', published: 'green', ongoing: 'cyan',
  completed: 'slate', cancelled: 'red',
};

export default function EventDetailPage() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState(false);
  const [showReassign, setShowReassign] = useState(false);
  const [organizers, setOrganizers] = useState([]);
  const [reassignLoading, setReassignLoading] = useState(false);
  const [selectedOrganizerId, setSelectedOrganizerId] = useState('');

  // Volunteer apply flow
  const [needs, setNeeds] = useState([]);
  const [myApplication, setMyApplication] = useState(null);
  const [applyingNeedId, setApplyingNeedId] = useState(null);

  // Attendee ticket purchase flow
  const [ticketTypes, setTicketTypes] = useState([]);
  const [myTicket, setMyTicket] = useState(null);
  const [buyingTypeId, setBuyingTypeId] = useState(null);
  const [paymentType, setPaymentType] = useState('cash');
  const [showBuyModal, setShowBuyModal] = useState(null); // holds the selected ticket type
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [paymentReference, setPaymentReference] = useState('');
  const [selectedMethodId, setSelectedMethodId] = useState(null);

  // Event-level feedback (visible when completed)
  const [eventFeedback, setEventFeedback] = useState(null); // { average, count, comments: [...] }
  const [qrPreview, setQrPreview] = useState(false);
  const [qrDownloading, setQrDownloading] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const { user } = useAuthStore();
  const toast = useToastStore();
  const navigate = useNavigate();

  useEffect(() => {
    eventsService.getEvent(id)
      .then((r) => {
        setEvent(r.data);
        // Once we know it's completed, fetch event feedback
        if (r.data?.status === 'completed') {
          feedbackService.getEventFeedback(id).then((fb) => {
            const list = Array.isArray(fb.data) ? fb.data : fb.data?.feedback || [];
            if (list.length > 0) {
              const avg = list.reduce((acc, x) => acc + (x.rating || x.score || 0), 0) / list.length;
              setEventFeedback({ average: avg, count: list.length, list });
            } else {
              setEventFeedback({ average: 0, count: 0, list: [] });
            }
          }).catch(() => { /* ignore */ });
        }
      })
      .catch(() => { useToastStore.getState().error('Event not found.'); navigate('/events'); })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  // Load volunteer needs + existing application (volunteer only)
  useEffect(() => {
    if (user?.role !== 'VOLUNTEER') return;
    Promise.allSettled([
      volunteersService.getNeedsByEvent(id),
      volunteersService.getMyApplications(),
    ]).then(([needsRes, appsRes]) => {
      if (needsRes.status === 'fulfilled') {
        setNeeds(needsRes.value.data || []);
      }
      if (appsRes.status === 'fulfilled') {
        const all = appsRes.value.data || [];
        const existing = all.find((a) => a.event_id === id);
        if (existing) setMyApplication(existing);
      }
    });
  }, [id, user?.role]);

  // Load ticket types + existing ticket + payment methods (attendee only)
  useEffect(() => {
    if (user?.role !== 'ATTENDEE') return;
    Promise.allSettled([
      ticketsService.getTicketTypes(id),
      ticketsService.getMyTickets(),
      paymentMethodsService.list(id),
    ]).then(([typesRes, ticketsRes, methodsRes]) => {
      if (typesRes.status === 'fulfilled') {
        setTicketTypes(typesRes.value.data || []);
      }
      if (ticketsRes.status === 'fulfilled') {
        const all = ticketsRes.value.data || [];
        const existing = all.find((t) => t.event_id === id);
        if (existing) setMyTicket(existing);
      }
      if (methodsRes.status === 'fulfilled') {
        setPaymentMethods(methodsRes.value.data || []);
      }
    });
  }, [id, user?.role]);

  const isOwner = user && event && (
    user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || event.organizer_id === user.id
  );
  const canManage = CAN_MANAGE.includes(user?.role) && isOwner;
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const isVolunteer = user?.role === 'VOLUNTEER';
  const isAttendee = user?.role === 'ATTENDEE';
  const nextStatus = event ? STATUS_FLOW[event.status] : null;

  const handleApply = async (needId) => {
    setApplyingNeedId(needId);
    try {
      const res = await volunteersService.applyToEvent(id, needId ? { needId } : {});
      setMyApplication(res.data || { status: 'pending', need_id: needId, event_id: id });
      toast.success('Application submitted! The organizer will review it.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to apply.');
    } finally {
      setApplyingNeedId(null);
    }
  };

  const handleBuyTicket = async () => {
    if (!showBuyModal) return;
    if (paymentType === 'online' && !selectedMethodId) {
      toast.error('Please select which provider you sent the payment through.');
      return;
    }
    if (paymentType === 'online' && !paymentReference.trim()) {
      toast.error('Please enter your transaction ID after sending the payment.');
      return;
    }
    setBuyingTypeId(showBuyModal.id);
    try {
      const res = await ticketsService.purchaseTicket({
        ticketTypeId: showBuyModal.id,
        paymentType,
        paymentReference: paymentType === 'online' ? paymentReference.trim() : undefined,
      });
      setMyTicket(res.data || { event_id: id, payment_status: 'pending' });
      toast.success(
        paymentType === 'cash'
          ? 'Ticket reserved! Pay at the venue — the organizer will confirm your payment.'
          : 'Ticket reserved! The organizer will verify your transaction and confirm.'
      );
      setShowBuyModal(null);
      setPaymentReference('');
      setSelectedMethodId(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to purchase ticket.');
    } finally {
      setBuyingTypeId(null);
    }
  };

  const openReassign = async () => {
    setShowReassign(true);
    setSelectedOrganizerId('');
    if (organizers.length === 0) {
      try {
        const r = await usersService.listUsers({ role: 'ORGANIZER', isApproved: 'true', limit: 100 });
        setOrganizers(r.data || []);
      } catch {
        toast.error('Failed to load organizers list.');
      }
    }
  };

  const handleReassign = async () => {
    if (!selectedOrganizerId) return;
    setReassignLoading(true);
    try {
      await eventsService.reassignOrganizer(id, selectedOrganizerId);
      // Refresh event to get the new organizer info
      const r = await eventsService.getEvent(id);
      setEvent(r.data);
      toast.success('Event organizer reassigned.');
      setShowReassign(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reassign organizer.');
    } finally {
      setReassignLoading(false);
    }
  };

  const handleAdvanceStatus = async () => {
    try {
      await eventsService.updateStatus(id, nextStatus);
      toast.success(`Event status updated to "${nextStatus}".`);
      setEvent((e) => ({ ...e, status: nextStatus }));
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to update status.');
    }
  };

  const handleCancel = async () => {
    try {
      await eventsService.updateStatus(id, 'cancelled');
      toast.success('Event cancelled.');
      setEvent((e) => ({ ...e, status: 'cancelled' }));
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to cancel.');
    }
  };

  const handleDelete = async () => {
    try {
      await eventsService.deleteEvent(id);
      toast.success('Event deleted.');
      navigate('/events');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to delete event.');
    }
  };

  if (loading) return (
    <>
      <Topbar />
      <div className="page-content"><PageSpinner /></div>
    </>
  );

  if (!event) return null;

  const startDate = fmtDate(event.start_date);
  const startTime = fmtTime(event.start_date);
  const endDate = fmtDate(event.end_date);
  const endTime = fmtTime(event.end_date);
  const venueRaw = event.venue || event.location || '';
  const isOnline = /^https?:\/\//i.test(venueRaw);
  const venue = venueRaw || 'Not specified';
  const attendeeCap = event.max_attendees ? `${event.max_attendees} seats` : 'Unlimited';
  const volunteerCap = event.max_volunteers ? `${event.max_volunteers} spots` : 'Unlimited';
  const dateRange = startDate === endDate ? startDate : `${startDate} – ${endDate}`;

  // Pick the right live countdown for the current event status.
  // - draft/published → counts down to start (cyan, "starts in")
  // - ongoing → counts down to end (amber, "ends in")
  // - completed/cancelled → no countdown
  let countdownConfig = null;
  if ((event.status === 'published' || event.status === 'draft') && event.start_date && new Date(event.start_date) > new Date()) {
    countdownConfig = {
      target: event.start_date,
      variant: 'starts',
      title: 'Event starts in',
      sub: `${startDate}${startTime ? ' · ' + startTime : ''}`,
    };
  } else if (event.status === 'ongoing' && event.end_date && new Date(event.end_date) > new Date()) {
    countdownConfig = {
      target: event.end_date,
      variant: 'ends',
      title: 'Event ends in',
      sub: `Closes ${endDate}${endTime ? ' · ' + endTime : ''}`,
    };
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard?.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link.');
    }
  };

  return (
    <>
      <Topbar />
      <div className="page-content">
        <div className="event-detail-page">
          <div className="event-detail-shell">
            {/* Action bar */}
            <div className="event-detail-header">
              <div className="event-detail-header__actions">
                {canManage && (
                  <>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/events/${id}/manage`)}>
                      <Icon name="dashboard" size={14} /> Manage
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/events/${id}/edit`)}>
                      <Icon name="edit" size={14} /> Edit
                    </button>
                    {nextStatus && (
                      <button className="btn btn-success btn-sm" onClick={() => setConfirmStatus(true)}>
                        <Icon name="arrowRight" size={14} /> {nextStatus === 'published' ? 'Publish' : `Advance to ${nextStatus}`}
                      </button>
                    )}
                  </>
                )}
                <button className="btn btn-primary btn-sm" onClick={() => setShowShareModal(true)}>
                  <Icon name="share" size={14} /> Share
                </button>
                {canManage && event.status !== 'cancelled' && event.status !== 'completed' && (
                  <button className="btn btn-danger btn-sm" onClick={() => setConfirmCancel(true)}>
                    Cancel
                  </button>
                )}
                {canManage && (
                  <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(true)}>
                    <Icon name="trash" size={14} /> Delete
                  </button>
                )}
              </div>
            </div>

            {/* Banner hero with overlaid title */}
            <div
              className={`event-banner${event.banner_url ? ' has-banner' : ''}`}
              style={event.banner_url ? { '--banner-url': `url(${event.banner_url})` } : undefined}
            >
              <div className="event-banner__badges">
                {event.status && event.status !== 'published' && (
                  <Badge label={event.status} color={STATUS_COLOR[event.status] || 'slate'} />
                )}
                {event.is_paid && <Badge label="Paid" color="amber" />}
              </div>
              <div className="event-banner__content">
                {event.category && (
                  <span className="event-banner__category">
                    <Icon name="spark" size={11} /> {event.category}
                  </span>
                )}
                <h1 className="event-banner__title">{event.title}</h1>
                <div className="event-banner__sub">
                  <span className="event-banner__sub-item">
                    <Icon name="calendar" size={14} /> {dateRange}
                  </span>
                  {(venueRaw || isOnline) && (
                    <span className="event-banner__sub-item">
                      <Icon name={isOnline ? 'spark' : 'mapPin'} size={14} />
                      {isOnline ? 'Online event' : venue}
                    </span>
                  )}
                  {event.organizer_name && (
                    <span className="event-banner__sub-item">
                      <Icon name="user" size={14} /> By {event.organizer_name}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Live countdown strip */}
            {countdownConfig && (
              <div className="event-countdown-strip">
                <div className="event-countdown-strip__label">
                  <div className="event-countdown-strip__title">{countdownConfig.title}</div>
                  <div className="event-countdown-strip__sub">{countdownConfig.sub}</div>
                </div>
                <Countdown
                  target={countdownConfig.target}
                  variant={countdownConfig.variant}
                  size="md"
                />
              </div>
            )}

            {/* Quick-meta strip */}
            <div className="event-quick-meta">
              <div className="event-quick-card">
                <div className="event-quick-card__icon" style={{ background: 'rgba(34,211,238,0.10)', color: 'var(--cyan-400)' }}>
                  <Icon name="calendar" size={18} />
                </div>
                <div className="event-quick-card__body">
                  <div className="event-quick-card__label">Starts</div>
                  <div className="event-quick-card__value">{startDate}{startTime ? ' · ' + startTime : ''}</div>
                </div>
              </div>
              <div className="event-quick-card">
                <div className="event-quick-card__icon" style={{ background: 'rgba(245,158,11,0.10)', color: 'var(--amber-400)' }}>
                  <Icon name="clock" size={18} />
                </div>
                <div className="event-quick-card__body">
                  <div className="event-quick-card__label">Ends</div>
                  <div className="event-quick-card__value">{endDate}{endTime ? ' · ' + endTime : ''}</div>
                </div>
              </div>
              <div className="event-quick-card">
                <div className="event-quick-card__icon" style={{ background: 'rgba(168,85,247,0.10)', color: 'var(--purple-400)' }}>
                  <Icon name={isOnline ? 'spark' : 'mapPin'} size={18} />
                </div>
                <div className="event-quick-card__body">
                  <div className="event-quick-card__label">{isOnline ? 'Meeting Link' : 'Venue'}</div>
                  <div className="event-quick-card__value" title={venue}>
                    {isOnline ? (
                      <a href={venueRaw} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>Join online</a>
                    ) : venue}
                  </div>
                </div>
              </div>
              <div className="event-quick-card">
                <div className="event-quick-card__icon" style={{ background: 'rgba(139,92,246,0.10)', color: '#a855f7' }}>
                  <Icon name="ticket" size={18} />
                </div>
                <div className="event-quick-card__body">
                  <div className="event-quick-card__label">Attendee Capacity</div>
                  <div className="event-quick-card__value">{attendeeCap}</div>
                </div>
              </div>
              <div className="event-quick-card">
                <div className="event-quick-card__icon" style={{ background: 'rgba(34,197,94,0.10)', color: 'var(--green-400)' }}>
                  <Icon name="users" size={18} />
                </div>
                <div className="event-quick-card__body">
                  <div className="event-quick-card__label">Volunteer Capacity</div>
                  <div className="event-quick-card__value">{volunteerCap}</div>
                </div>
              </div>
            </div>

            <div className="event-details-below">

          {/* Two-column body */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr',
            gap: 20,
            alignItems: 'start',
          }} className="event-detail-grid">

            {/* Left: description + deadlines + ratings */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* About */}
              {event.description && (
                <div className="event-section-card">
                  <h3 className="event-section-title">
                    <span className="event-section-title__bar" />
                    About this event
                  </h3>
                  <div className="event-description">{event.description}</div>
                </div>
              )}

              {/* Registration deadlines */}
              <div className="event-section-card">
                <h3 className="event-section-title">
                  <span className="event-section-title__bar" />
                  Registration deadlines
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                  <div style={{ padding: '12px 14px', background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.18)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--green-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                      Volunteer applications close
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {event.volunteer_registration_deadline
                        ? `${fmtDate(event.volunteer_registration_deadline)} · ${fmtTime(event.volunteer_registration_deadline)}`
                        : 'Same as event start'}
                    </div>
                  </div>
                  <div style={{ padding: '12px 14px', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.18)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                      Ticket sales close
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {event.attendee_registration_deadline
                        ? `${fmtDate(event.attendee_registration_deadline)} · ${fmtTime(event.attendee_registration_deadline)}`
                        : 'Same as event start'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Event ratings — only after the event completes */}
              {eventFeedback && eventFeedback.count > 0 && (
                <div className="event-section-card" style={{ borderColor: 'rgba(245,158,11,0.25)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
                    <h3 className="event-section-title" style={{ margin: 0 }}>
                      <Icon name="star" size={18} color="var(--amber-400)" />
                      Attendee Feedback
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>
                        from {eventFeedback.count} {eventFeedback.count === 1 ? 'review' : 'reviews'}
                      </span>
                    </h3>
                    <StarRating value={eventFeedback.average} count={eventFeedback.count} size={18} />
                  </div>

                  {/* Recent comments */}
                  {eventFeedback.list.filter((x) => x.comment).slice(0, 5).length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {eventFeedback.list.filter((x) => x.comment).slice(0, 5).map((fb, i) => (
                        <div key={fb.id || i} style={{ padding: '10px 14px', background: 'rgba(34,211,238,0.04)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                              {fb.full_name || fb.user_name || 'Anonymous'}
                            </div>
                            <StarRating value={fb.rating || fb.score || 0} size={11} showValue={false} />
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--text-default)', fontStyle: 'italic', lineHeight: 1.5 }}>
                            "{fb.comment}"
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right sidebar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Volunteer Apply (volunteer only) */}
              {isVolunteer && (
                <div className="event-section-card" style={{ borderColor: 'rgba(34,211,238,0.25)' }}>
                  <h3 className="event-section-title">
                    <Icon name="users" size={16} color="var(--accent)" />
                    Volunteer
                  </h3>

                  {/* Application deadline countdown — inline, contextual */}
                  {!myApplication && event.volunteer_registration_deadline && (event.status === 'published' || event.status === 'ongoing') && (
                    <div style={{ marginBottom: 14 }}>
                      <Countdown
                        target={event.volunteer_registration_deadline}
                        variant="deadline"
                        label="Applications close in"
                        expiredLabel="Applications closed"
                        size="sm"
                      />
                    </div>
                  )}

                  {myApplication ? (
                    // Already applied — show status
                    <div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
                        Your application status:
                      </div>
                      <Badge
                        label={myApplication.status || 'pending'}
                        color={
                          myApplication.status === 'approved' ? 'green' :
                          myApplication.status === 'rejected' ? 'red' : 'amber'
                        }
                      />
                      {myApplication.role_name && (
                        <div style={{ fontSize: 13, color: 'var(--text-default)', marginTop: 10 }}>
                          Role: <strong>{myApplication.role_name}</strong>
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12, lineHeight: 1.6 }}>
                        {myApplication.status === 'approved' && 'You\'re approved! Check your dashboard for further details.'}
                        {myApplication.status === 'rejected' && 'Your application was not selected this time.'}
                        {(!myApplication.status || myApplication.status === 'pending') && 'The organizer will review your application soon.'}
                      </div>
                    </div>
                  ) : event.status === 'cancelled' || event.status === 'completed' ? (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      This event is no longer accepting volunteers.
                    </div>
                  ) : event.volunteer_registration_deadline && new Date(event.volunteer_registration_deadline) < new Date() ? (
                    <div style={{ fontSize: 13, color: 'var(--red-400)' }}>
                      Volunteer applications closed on {new Date(event.volunteer_registration_deadline).toLocaleString()}.
                    </div>
                  ) : needs.length === 0 ? (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      The organizer hasn't posted volunteer roles yet. Check back later.
                    </div>
                  ) : (
                    // Show available roles to apply to
                    <div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
                        Pick a role to apply for:
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {needs.map((need) => {
                          const filled = (need.applied_count ?? 0) >= (need.headcount ?? 0) && need.headcount > 0;
                          return (
                            <div
                              key={need.id}
                              style={{
                                padding: '10px 12px',
                                background: 'rgba(34,211,238,0.05)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: 'var(--radius-md)',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {need.role_name}
                                </div>
                                {need.headcount > 0 && (
                                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                    {need.applied_count ?? 0}/{need.headcount}
                                  </span>
                                )}
                              </div>
                              {need.description && (
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.5 }}>
                                  {need.description}
                                </div>
                              )}
                              <button
                                className="btn btn-primary btn-sm btn-full"
                                onClick={() => handleApply(need.id)}
                                disabled={!!applyingNeedId || filled}
                              >
                                {applyingNeedId === need.id ? 'Applying…' : filled ? 'Full' : 'Apply'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Attendee tickets (attendee only) */}
              {isAttendee && (
                <div className="event-section-card" style={{ borderColor: 'rgba(34,211,238,0.25)' }}>
                  <h3 className="event-section-title">
                    <Icon name="ticket" size={16} color="var(--accent)" />
                    Attend This Event as Attendee
                  </h3>

                  {(() => {
                    const status = myTicket?.payment_status;
                    const isRejected = status === 'rejected';
                    const isReapplied = status === 'reapplied';
                    const hasActiveTicket = myTicket && !isRejected;

                    if (hasActiveTicket) {
                      return (
                        <div>
                          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>You have a ticket:</div>
                          <Badge label={status || 'pending'} />
                          {myTicket.ticket_type_name && (
                            <div style={{ fontSize: 13, color: 'var(--text-default)', marginTop: 10 }}>
                              Type: <strong>{myTicket.ticket_type_name}</strong>
                            </div>
                          )}
                          <div style={{ fontSize: 12, color: isReapplied ? '#60a5fa' : 'var(--text-muted)', marginTop: 12, lineHeight: 1.6 }}>
                            {status === 'confirmed'
                              ? 'Your ticket is confirmed. Find your QR code in My Tickets.'
                              : isReapplied
                              ? 'Your reapplication is under review. The organizer will confirm or reject it shortly.'
                              : 'Pay at the venue and the organizer will confirm your payment.'}
                          </div>
                          <button
                            className="btn btn-secondary btn-sm btn-full"
                            style={{ marginTop: 14 }}
                            onClick={() => navigate('/my-tickets')}
                          >
                            View My Tickets
                          </button>
                        </div>
                      );
                    }

                    // Rejected — show notice + Support button (no ticket types)
                    if (isRejected) {
                      return (
                        <div>
                          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>You have a ticket:</div>
                          <Badge label="rejected" />
                          {myTicket.ticket_type_name && (
                            <div style={{ fontSize: 13, color: 'var(--text-default)', marginTop: 10 }}>
                              Type: <strong>{myTicket.ticket_type_name}</strong>
                            </div>
                          )}
                          <div style={{ fontSize: 12, color: 'var(--red-400)', marginTop: 12, lineHeight: 1.6 }}>
                            Your payment could not be verified by the organizer. You can reapply with new payment proof.
                          </div>
                          <button
                            className="btn btn-sm btn-full"
                            style={{
                              marginTop: 14,
                              background: 'rgba(239,68,68,0.1)',
                              border: '1px solid rgba(239,68,68,0.3)',
                              color: 'var(--red-400)',
                              fontWeight: 600,
                            }}
                            onClick={() => navigate('/my-tickets')}
                          >
                            Support
                          </button>
                        </div>
                      );
                    }

                    // No ticket — show normal purchase flow
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {event.status === 'cancelled' || event.status === 'completed' ? (
                          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                            This event is no longer accepting registrations.
                          </div>
                        ) : event.attendee_registration_deadline && new Date(event.attendee_registration_deadline) < new Date() ? (
                          <div style={{ fontSize: 13, color: 'var(--red-400)' }}>
                            Ticket sales closed on {new Date(event.attendee_registration_deadline).toLocaleString()}.
                          </div>
                        ) : !event.is_paid ? (
                          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                            This is a free event. No ticket required — just show up at the venue.
                          </div>
                        ) : ticketTypes.length === 0 ? (
                          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                            The organizer hasn't published ticket yet. Check back later.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {ticketTypes.map((tt) => {
                              const soldOut = tt.available_quantity != null && tt.available_quantity <= 0;
                              const remaining = tt.available_quantity ?? tt.quantity;
                              const pct = tt.quantity > 0 ? Math.round(((tt.quantity - (tt.available_quantity ?? 0)) / tt.quantity) * 100) : 0;
                              return (
                                <div key={tt.id} style={{
                                  border: `1px solid ${soldOut ? 'var(--border-subtle)' : 'rgba(139,92,246,0.2)'}`,
                                  borderRadius: 12,
                                  padding: '14px 16px',
                                  background: soldOut ? 'var(--bg-surface-2)' : 'var(--bg-surface)',
                                  opacity: soldOut ? 0.65 : 1,
                                }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{tt.name}</div>
                                      {tt.available_quantity != null && (
                                        <div style={{ fontSize: 11, color: soldOut ? 'var(--red-400)' : 'var(--text-muted)', marginTop: 2 }}>
                                          {soldOut ? 'Sold out' : `${remaining} of ${tt.quantity} remaining`}
                                        </div>
                                      )}
                                      {tt.quantity > 0 && (
                                        <div style={{ height: 3, background: 'var(--border-subtle)', borderRadius: 99, marginTop: 8, overflow: 'hidden' }}>
                                          <div style={{ height: '100%', width: `${pct}%`, background: pct >= 90 ? 'var(--red-400)' : 'var(--accent)', borderRadius: 99, transition: 'width 0.4s' }} />
                                        </div>
                                      )}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                                      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--accent)' }}>
                                        {Number(tt.price).toFixed(2)} ৳
                                      </div>
                                      <button
                                        className="btn btn-sm"
                                        style={{
                                          background: soldOut ? 'transparent' : 'var(--accent)',
                                          color: soldOut ? 'var(--text-muted)' : '#fff',
                                          border: soldOut ? '1px solid var(--border-soft)' : 'none',
                                          borderRadius: 20,
                                          padding: '5px 14px',
                                          fontSize: 12,
                                          fontWeight: 600,
                                          cursor: soldOut ? 'default' : 'pointer',
                                          whiteSpace: 'nowrap',
                                        }}
                                        onClick={() => { if (!soldOut) { setShowBuyModal(tt); setPaymentType('cash'); } }}
                                        disabled={soldOut}
                                      >
                                        {soldOut ? 'Sold Out' : 'Get Ticket'}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Organizer */}
              {(event.organizer_name || event.organizer_email) && (
                <div className="event-section-card">
                  <h3 className="event-section-title">
                    <Icon name="user" size={16} color="var(--accent)" />
                    Organizer
                  </h3>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                    {event.organizer_name || event.organizer_email}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                    {event.organizer_email}
                  </div>
                  {isAdmin && (
                    <button
                      className="btn btn-secondary btn-sm btn-full"
                      style={{ marginTop: 14 }}
                      onClick={openReassign}
                    >
                      <Icon name="refresh" size={14} /> Reassign to another organizer
                    </button>
                  )}
                </div>
              )}

              {/* Event QR code — for sharing & at-venue display */}
              {event.qr_code_url && (
                <div className="event-section-card" style={{ textAlign: 'center' }}>
                  <h3 className="event-section-title" style={{ justifyContent: 'center' }}>
                    <Icon name="qr" size={16} color="var(--accent)" />
                    Event QR Code
                  </h3>

                  {/* QR image with hover preview overlay */}
                  <div
                    style={{
                      position: 'relative',
                      display: 'inline-block',
                      cursor: 'pointer',
                      borderRadius: 12,
                      overflow: 'hidden',
                      border: '1px solid var(--border-subtle)',
                      background: '#fff',
                      padding: 8,
                      marginTop: 4,
                    }}
                    onClick={() => setQrPreview(true)}
                    title="Click to preview"
                    className="event-qr-wrap"
                  >
                    <img
                      src={event.qr_code_url}
                      alt={`QR code for ${event.title}`}
                      style={{ display: 'block', width: 200, height: 200, objectFit: 'contain' }}
                      draggable={false}
                    />
                    <div className="event-qr-hover">
                      <Icon name="eye" size={22} color="#fff" />
                      <span>Preview</span>
                    </div>
                  </div>

                  {event.event_code && (
                    <div style={{
                      marginTop: 12,
                      fontSize: 13,
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      color: 'var(--text-primary)',
                      userSelect: 'all',
                    }}>
                      {event.event_code}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
                    Scan to open the event page
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        navigator.clipboard?.writeText(event.event_code || '');
                        toast.success('Event code copied');
                      }}
                    >
                      <Icon name="clipboard" size={13} /> Copy code
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={qrDownloading}
                      onClick={async () => {
                        setQrDownloading(true);
                        try {
                          const res = await fetch(event.qr_code_url);
                          const blob = await res.blob();
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `${event.event_code || 'event'}-qr.png`;
                          a.click();
                          URL.revokeObjectURL(url);
                        } catch {
                          toast.error('Download failed. Try right-clicking the image.');
                        } finally {
                          setQrDownloading(false);
                        }
                      }}
                    >
                      <Icon name="download" size={13} /> {qrDownloading ? 'Downloading…' : 'Download'}
                    </button>
                  </div>
                </div>
              )}

              {/* QR preview lightbox */}
              {qrPreview && (
                <div
                  className="modal-overlay"
                  onClick={() => setQrPreview(false)}
                  style={{ zIndex: 1000 }}
                >
                  <div
                    style={{
                      background: '#fff',
                      borderRadius: 20,
                      padding: 24,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 14,
                      maxWidth: 360,
                      width: '90%',
                      boxShadow: '0 32px 80px rgba(2,6,23,0.28)',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {event.title}
                    </div>
                    <img
                      src={event.qr_code_url}
                      alt="QR code preview"
                      style={{ width: '100%', maxWidth: 280, borderRadius: 12, border: '1px solid var(--border-subtle)' }}
                    />
                    {event.event_code && (
                      <div style={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.1em', fontSize: 16 }}>
                        {event.event_code}
                      </div>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={() => setQrPreview(false)}>
                      Close
                    </button>
                  </div>
                </div>
              )}

              {/* Gallery */}
              {event.gallery?.length > 0 && (
                <div className="event-section-card">
                  <h3 className="event-section-title">
                    <span className="event-section-title__bar" />
                    Gallery
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    {event.gallery.map((img) => (
                      <img
                        key={img.id}
                        src={img.url}
                        alt="gallery"
                        style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <ConfirmModal
            isOpen={confirmDelete}
            onClose={() => setConfirmDelete(false)}
            onConfirm={handleDelete}
            title="Delete Event"
            message={`Delete "${event.title}" permanently? All related data will be removed.`}
            confirmText="Delete"
            danger
          />
          <ConfirmModal
            isOpen={confirmCancel}
            onClose={() => setConfirmCancel(false)}
            onConfirm={handleCancel}
            title="Cancel Event"
            message={`Cancel "${event.title}"? Volunteers and ticket holders will be notified. This can't be reverted.`}
            confirmText="Cancel Event"
            danger
          />
          <ConfirmModal
            isOpen={confirmStatus}
            onClose={() => setConfirmStatus(false)}
            onConfirm={handleAdvanceStatus}
            title="Update Status"
            message={`Advance event status from "${event.status}" to "${nextStatus}"?`}
            confirmText="Confirm"
          />

          {/* Buy ticket modal */}
          {showBuyModal && (
            <div className="modal-overlay" onClick={() => !buyingTypeId && setShowBuyModal(null)}>
              <div className="modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
                <div className="card-header">
                  <div className="card-title">Buy Ticket</div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowBuyModal(null)} disabled={!!buyingTypeId}>
                    <Icon name="x" size={14} />
                  </button>
                </div>
                <div style={{ marginBottom: 16, padding: '14px 16px', background: 'rgba(34,211,238,0.06)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{showBuyModal.name}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>{Number(showBuyModal.price).toFixed(2)} ৳</div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{event.title}</div>
                </div>

                <div className="input-wrap" style={{ marginBottom: 18 }}>
                  <label className="input-label">Payment Method</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      event.allow_cash !== false && { value: 'cash', label: 'Cash at venue', desc: 'Reserve now, pay the organizer at the event' },
                      event.allow_online !== false && {
                        value: 'online',
                        label: 'Online transfer',
                        desc: paymentMethods.length > 0
                          ? `Send via ${paymentMethods.map((m) => (PAYMENT_METHOD_TYPES.find(t => t.value === m.method_type)?.label || m.method_type)).join(' / ')}, then enter the TrxID`
                          : 'Organizer hasn\'t added online payment methods yet',
                        disabled: paymentMethods.length === 0,
                      },
                    ].filter(Boolean).map((opt) => (
                      <label
                        key={opt.value}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 10,
                          padding: '12px 14px',
                          border: `1px solid ${paymentType === opt.value ? 'var(--accent)' : 'var(--border-soft)'}`,
                          borderRadius: 'var(--radius-md)',
                          background: paymentType === opt.value ? 'rgba(34,211,238,0.06)' : 'transparent',
                          cursor: opt.disabled ? 'not-allowed' : 'pointer',
                          opacity: opt.disabled ? 0.5 : 1,
                          transition: 'all var(--transition-fast)',
                        }}
                      >
                        <input
                          type="radio"
                          name="paymentType"
                          value={opt.value}
                          checked={paymentType === opt.value}
                          onChange={(e) => setPaymentType(e.target.value)}
                          disabled={opt.disabled}
                          style={{ marginTop: 2, accentColor: 'var(--accent)' }}
                        />
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{opt.label}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{opt.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Online payment instructions */}
                {paymentType === 'online' && paymentMethods.length > 0 && (
                  <div style={{
                    padding: 14,
                    background: 'rgba(34,211,238,0.06)',
                    border: '1px solid rgba(34,211,238,0.25)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 18,
                  }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                      Step 1 · Select your payment provider &amp; send {Number(showBuyModal.price).toFixed(2)} ৳
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {paymentMethods.map((m) => {
                        const meta = PAYMENT_METHOD_TYPES.find((t) => t.value === m.method_type);
                        const isSelected = selectedMethodId === m.id;
                        return (
                          <div key={m.id}
                            onClick={() => setSelectedMethodId(m.id)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 12,
                              padding: '10px 12px',
                              background: isSelected ? 'rgba(139,92,246,0.06)' : 'var(--bg-surface)',
                              borderRadius: 'var(--radius-md)',
                              border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border-subtle)'}`,
                              cursor: 'pointer',
                              transition: 'border-color 0.15s, background 0.15s',
                            }}>
                            {/* Radio dot */}
                            <div style={{
                              width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                              border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border-soft)'}`,
                              background: isSelected ? 'var(--accent)' : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              {isSelected && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                            </div>
                            {meta?.icon
                              ? <img src={meta.icon} alt={meta.label} style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                              : <span style={{ background: meta?.color || '#64748b', color: 'white', fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>{meta?.label || m.method_type}</span>
                            }
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace', userSelect: 'all' }}>
                                {m.account_number}
                                {m.account_label && <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 12, fontFamily: 'inherit', marginLeft: 6 }}>· {m.account_label}</span>}
                              </div>
                              {m.account_name && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{m.account_name}</div>}
                              {m.instructions && <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 2 }}>{m.instructions}</div>}
                            </div>
                            <button type="button" className="btn btn-ghost btn-sm"
                              onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(m.account_number); toast.success('Copied'); }}
                              title="Copy" style={{ padding: 4 }}>
                              <Icon name="clipboard" size={13} />
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {selectedMethodId && (
                      <>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '14px 0 6px' }}>
                          Step 2 · Enter your transaction ID
                        </div>
                        <input
                          className="input-field"
                          placeholder="e.g. 8AB12CD34E"
                          value={paymentReference}
                          onChange={(e) => setPaymentReference(e.target.value)}
                          style={{ fontFamily: 'monospace' }}
                        />
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
                          Your ticket stays <strong>pending</strong> until the organizer verifies your TrxID. They'll confirm and your QR code becomes valid.
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setShowBuyModal(null); setPaymentReference(''); setSelectedMethodId(null); }} disabled={!!buyingTypeId}>Cancel</button>
                  <button className="btn btn-primary btn-sm" onClick={handleBuyTicket}
                    disabled={!!buyingTypeId || (paymentType === 'online' && (!selectedMethodId || !paymentReference.trim()))}>
                    {buyingTypeId ? 'Processing…' : `Reserve — ${Number(showBuyModal.price).toFixed(2)} ৳`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Reassign organizer modal */}
          {/* Share modal */}
          <Modal isOpen={showShareModal} onClose={() => setShowShareModal(false)} title="Share Event" size="sm">
            {event && (() => {
              const url = window.location.href;
              const text = encodeURIComponent(event.title);
              const encodedUrl = encodeURIComponent(url);
              const socials = [
                {
                  label: 'WhatsApp',
                  color: '#25d366',
                  href: `https://wa.me/?text=${text}%20${encodedUrl}`,
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.118.554 4.107 1.523 5.83L.057 23.885l6.231-1.635A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.007-1.371l-.36-.213-3.7.97.988-3.609-.235-.371A9.818 9.818 0 012.182 12c0-5.42 4.398-9.818 9.818-9.818 5.42 0 9.818 4.398 9.818 9.818 0 5.42-4.398 9.818-9.818 9.818z"/>
                    </svg>
                  ),
                },
                {
                  label: 'Facebook',
                  color: '#1877f2',
                  href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
                    </svg>
                  ),
                },
                {
                  label: 'X (Twitter)',
                  color: '#000',
                  href: `https://twitter.com/intent/tweet?text=${text}&url=${encodedUrl}`,
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  ),
                },
              ];

              return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
                  {event.qr_code_url && (
                    <div style={{ background: '#fff', padding: 12, borderRadius: 12, border: '1px solid var(--border-subtle)', display: 'inline-block' }}>
                      <img src={event.qr_code_url} alt="Event QR code" style={{ width: 160, height: 160, display: 'block' }} />
                    </div>
                  )}
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                    Scan the QR code or share the link below
                  </div>

                  {/* Copy link */}
                  <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                    <input
                      readOnly
                      value={url}
                      className="input-field"
                      style={{ flex: 1, fontSize: 12, fontFamily: 'monospace' }}
                      onFocus={(e) => e.target.select()}
                    />
                    <button className="btn btn-secondary" onClick={handleCopyLink} style={{ whiteSpace: 'nowrap', minWidth: 80, height: 44, flexShrink: 0 }}>
                      {linkCopied ? <><Icon name="checkCircle" size={14} /> Copied!</> : <><Icon name="clipboard" size={14} /> Copy</>}
                    </button>
                  </div>

                  {/* Social share */}
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'center', width: '100%' }}>
                    {socials.map((s) => (
                      <a
                        key={s.label}
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Share on ${s.label}`}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                          flex: 1, padding: '12px 8px', borderRadius: 10,
                          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                          color: s.color, textDecoration: 'none', fontSize: 11, fontWeight: 500,
                          transition: 'transform 0.15s, box-shadow 0.15s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                      >
                        {s.icon}
                        <span style={{ color: 'var(--text-muted)' }}>{s.label}</span>
                      </a>
                    ))}
                  </div>
                </div>
              );
            })()}
          </Modal>

          {showReassign && (
            <div className="modal-overlay" onClick={() => !reassignLoading && setShowReassign(false)}>
              <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
                <div className="card-header">
                  <div className="card-title">Reassign Organizer</div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowReassign(false)} disabled={reassignLoading}>
                    <Icon name="x" size={14} />
                  </button>
                </div>
                <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 0, marginBottom: 16, lineHeight: 1.6 }}>
                  Transfer ownership of <strong style={{ color: 'var(--text-primary)' }}>{event.title}</strong> to a different approved organizer. They will gain full management access; the current organizer will lose it.
                </p>
                <div className="input-wrap" style={{ marginBottom: 18 }}>
                  <label className="input-label" htmlFor="organizer-select">New Organizer</label>
                  <select
                    id="organizer-select"
                    className="input-field select-field"
                    value={selectedOrganizerId}
                    onChange={(e) => setSelectedOrganizerId(e.target.value)}
                    disabled={reassignLoading}
                  >
                    <option value="">— Select an organizer —</option>
                    {organizers
                      .filter((o) => o.id !== event.organizer_id)
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.full_name || o.email} ({o.email})
                        </option>
                      ))}
                  </select>
                  {organizers.length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Loading organizers…</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowReassign(false)} disabled={reassignLoading}>
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleReassign}
                    disabled={!selectedOrganizerId || reassignLoading}
                  >
                    {reassignLoading ? 'Reassigning…' : 'Reassign Organizer'}
                  </button>
                </div>
              </div>
            </div>
          )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
