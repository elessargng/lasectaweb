/**
 * Una bolsa de tela con cordón (como las de dados de rol o las de canicas), con
 * el trazo de los iconos de lucide: barriga redonda, el cuello fruncido por el
 * cordón, la boca abierta en abanico y el nudo colgando. Decorativo (el botón
 * que lo lleva tiene su nombre): oculto al lector, como los de lucide.
 */
const IconoBolsa = ({ size = 24, strokeWidth = 2 }: { size?: number; strokeWidth?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {/* La boca, abierta en abanico por encima del cordón */}
    <path d="M9 8.5 7.2 4.6c1.6.4 3.1.6 4.8.6s3.2-.2 4.8-.6L15 8.5" />
    {/* La barriga: ancha y redonda, apoyada abajo */}
    <path d="M9 9.5C5.6 11.3 4 13.9 4 16.6 4 19.8 7.2 21.5 12 21.5s8-1.7 8-4.9c0-2.7-1.6-5.3-5-7.1" />
    {/* El cordón que frunce el cuello */}
    <path d="M8.5 9h7" />
    {/* El nudo y las puntas del cordón, colgando */}
    <path d="M14.5 9.2c.8 1 1.3 2 1.4 3.3" />
    <path d="M15.6 9.1c1.1.7 1.9 1.6 2.4 2.7" />
    {/* Un pliegue de la tela */}
    <path d="M10 13.5c-.6 1.3-.8 2.6-.6 4" />
  </svg>
);

export default IconoBolsa;
