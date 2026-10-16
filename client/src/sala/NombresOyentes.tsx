import { Ear } from 'lucide-react';
import { Fragment } from 'react';

/**
 * Los que escuchan una conversación (no hablan ni se ven), cada uno con una
 * oreja delante: «👂Ana, 👂Luis y 👂Bea». La oreja es solo visual; el texto de
 * alrededor («Escuchan: …») ya lo dice.
 */
const NombresOyentes = ({ nombres }: { nombres: string[] }) => (
  <>
    {nombres.map((nombre, i) => (
      <Fragment key={`${i}-${nombre}`}>
        {i > 0 && (i === nombres.length - 1 ? ' y ' : ', ')}
        <span className="whitespace-nowrap">
          <Ear size={12} className="mr-0.5 inline-block align-[-1px] text-theme-main" />
          {nombre}
        </span>
      </Fragment>
    ))}
  </>
);

export default NombresOyentes;
