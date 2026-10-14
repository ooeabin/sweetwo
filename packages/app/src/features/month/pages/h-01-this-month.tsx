import { Button } from '@sweetwo/ui';
import { copy } from '../copy';

// H-01 이번 달 (뼈대). 실제 요소는 docs/spec/19-this-month.md 요소 표 기준으로 채운다.
export function H01ThisMonth() {
  return (
    <section className="hg-today">
      <div className="hg-today__in">
        <div className="hg-today__row">
          <div className="hg-today__text">
            <span className="hg-today__date">10월 14일(수)</span>
            <h1 className="hg-today__title">{copy.greetingNoSplit('찬우', 32)}</h1>
          </div>
          <Button variant="primary">{copy.spendEntry}</Button>
        </div>
      </div>
    </section>
  );
}
