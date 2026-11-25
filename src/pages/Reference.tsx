import { CODE_ROWS, GLOSSARY, INCREMENT_ROWS, KEY_ROWS, SOURCES, UNVERIFIED, type RefRow } from '../content/reference';
import { useT } from '../i18n';

function Table({ rows, testid, sourceLabel, cols }: { rows: RefRow[]; testid: string; sourceLabel: (s: RefRow['source']) => string; cols: [string, string, string] }) {
  return (
    <table className="lib ref" data-testid={testid}>
      <thead><tr><th>{cols[0]}</th><th>{cols[1]}</th><th>{cols[2]}</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.name}><td>{r.name}</td><td>{r.value}</td><td className="small">{sourceLabel(r.source)}</td></tr>)}</tbody>
    </table>
  );
}

/** Reference library: sources, control facts, supported commands, glossary and the unverified list. */
export default function Reference() {
  const t = useT();
  const cols: [string, string, string] = [t('col.item'), t('col.detail'), t('col.source')];
  return (
    <div className="page" data-testid="reference">
      <h2>{t('ref.title')}</h2>
      <p className="small">{t('ref.intro')}</p>
      <p className="small">{t('ref.contentNote')}</p>

      <section><h3>{t('ref.sources')}</h3>
        <table className="lib" data-testid="ref-sources">
          <thead><tr><th>{t('col.id')}</th><th>{t('col.document')}</th><th>{t('col.used')}</th></tr></thead>
          <tbody>{SOURCES.map((s) => <tr key={s.id}><td>{s.id}</td><td>{s.title}<div className="small">{s.doc}</div></td><td>{s.used}</td></tr>)}</tbody>
        </table>
      </section>

      <section><h3>{t('ref.keys')}</h3>
        <Table rows={KEY_ROWS} testid="ref-keys" cols={cols} sourceLabel={(s) => s} />
      </section>

      <section><h3>{t('ref.increments')}</h3>
        <Table rows={INCREMENT_ROWS} testid="ref-increments" cols={cols} sourceLabel={(s) => s} />
      </section>

      <section><h3>{t('ref.codes')}</h3>
        <Table rows={CODE_ROWS} testid="ref-codes" cols={cols} sourceLabel={(s) => (s === 'sim' ? t('ref.source.sim') : s)} />
      </section>

      <section><h3>{t('ref.glossary')}</h3>
        <dl className="glossary" data-testid="ref-glossary">
          {GLOSSARY.map((g) => <div key={g.term}><dt>{g.term}</dt><dd>{g.def}</dd></div>)}
        </dl>
      </section>

      <section><h3>{t('ref.unverified')}</h3>
        <ul className="warn" data-testid="ref-unverified">{UNVERIFIED.map((u) => <li key={u}>{u}</li>)}</ul>
      </section>
    </div>
  );
}
