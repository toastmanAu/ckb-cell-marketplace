import { Link } from 'react-router-dom';
import { ccc } from '@ckb-ccc/connector-react';
import { ContentRenderer } from './ContentRenderer';
import { ReportButton } from './ReportButton';
import { categoriseContent, categoryLabel, badgeClass } from '../lib/content';
import { shannonsToCkb } from '../lib/codec';
import type { ListingInfo } from '../types';

interface ItemCardProps {
  listing: ListingInfo;
  viewCount?: number;
}

export function ItemCard({ listing, viewCount }: ItemCardProps) {
  const { marketItem, lsdlArgs, outPoint } = listing;
  const category = categoriseContent(marketItem.contentType);
  const outPointId = `${ccc.hexFrom(outPoint.txHash)}:${outPoint.index}`;

  return (
    <Link to={`/item/${encodeURIComponent(outPointId)}`} style={{ textDecoration: 'none' }}>
      <div className="card" style={{ cursor: 'pointer' }}>
        <div style={{ marginBottom: '0.75rem' }}>
          <ContentRenderer item={marketItem} mode="preview" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span className={badgeClass(category)}>
            {categoryLabel(marketItem.contentType)}
            {lsdlArgs.isLegacy && <span title="Locked legacy script — unspendable" style={{ marginLeft: '0.35rem', color: 'var(--warning, #a86a00)' }}>*</span>}
          </span>
          <span className="price">{shannonsToCkb(lsdlArgs.totalValue)} CKB</span>
        </div>
        <div style={{ fontSize: '0.88rem', color: 'var(--text)', lineHeight: 1.4 }}>
          {marketItem.description.length > 80
            ? marketItem.description.slice(0, 80) + '...'
            : marketItem.description}
        </div>
        {lsdlArgs.isLegacy && (
          <div style={{ fontSize: '0.72rem', color: 'var(--warning, #a86a00)', marginTop: '0.4rem', fontStyle: 'italic' }}>
            * Locked legacy script
          </div>
        )}
        {lsdlArgs.royaltyBps > 0 && (
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.4rem' }}>
            {(lsdlArgs.royaltyBps / 100).toFixed(1)}% royalty
          </div>
        )}
        <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span
            title={viewCount !== undefined ? `${viewCount} ${viewCount === 1 ? 'view' : 'views'}` : 'Views loading...'}
            style={{ fontSize: '0.78rem', color: viewCount ? 'var(--accent)' : 'var(--muted)' }}
          >
            👁 {viewCount ?? '·'}
          </span>
          <ReportButton
            outPoint={outPoint}
            creatorLockHash={ccc.hexFrom(lsdlArgs.creatorLockHash)}
            contentType={marketItem.contentType}
            description={marketItem.description}
            variant="icon"
          />
        </div>
      </div>
    </Link>
  );
}
