export const LOGO_URL = 'https://res.cloudinary.com/dnpun8jzt/image/upload/v1778610617/logo-campusflow_lsgadq.png';

export default function AppLogo({ size = 'md', variant = 'full' }) {
  const subText = size === 'lg' ? 'University Volunteer Management' : 'UVMS';
  const sz = size === 'sm' || size === 'lg' ? size : 'md';

  return (
    <div className={`app-logo app-logo--${sz}`}>
      <img src={LOGO_URL} alt="CampusFlow" className={`app-logo__img app-logo__img--${sz}`} />

      {variant !== 'icon-only' && (
        <div className="app-logo__text">
          <div className="app-logo__name">CampusFlow</div>
          <div className="app-logo__sub">{subText}</div>
        </div>
      )}
    </div>
  );
}
