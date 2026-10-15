import React from 'react';

interface CitaProps {
  texto: string;
}

const Cita: React.FC<CitaProps> = ({ texto }) => {
  const renderTexto = (txt: string) => {
    const parts = txt.split('*');
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return (
          <strong key={index} className="text-theme-main font-bold">
            {part}
          </strong>
        );
      }
      return part;
    });
  };

  return (
    <div className="quote-container">
      <div aria-hidden="true" className="ornament-divider mb-5 text-lg leading-none">❦</div>
      <p className="quote-text">
        «{renderTexto(texto)}»
      </p>
      <div aria-hidden="true" className="hairline-gold mt-6" />
    </div>
  );
};

export default Cita;
