"use client";

/**
 * "List" and "Grid" switch above a collection list.
 * List is Payload's own table; Grid shows the SAME page of results (filters,
 * sort, search, pagination, and the selected site on multi-site) as large
 * tiles, because it reads the list's own data through useListQuery instead of
 * fetching again. The editor's choice is a user preference
 * (`collection-<slug>-view`), so `defaultView` only decides the first visit.
 *
 * Register per collection:
 *   admin.components.beforeListTable: [{
 *     path: LIST_GRID_SWITCH, // from @webheroco/payload-admin
 *     clientProps: { collectionSlug: "pages", defaultView: "grid" },
 *   }]
 *
 * Tiles: Media shows the image (logos and graphics whole, since the thumbnail
 * size is centre-cropped); a published page or post shows the page itself in
 * a sandboxed iframe loaded at desktop width and scaled down; anything else a
 * letter. Every link has prefetch={false}: prefetching rendered an edit page
 * behind every visible tile and starved the database pool.
 *
 * The page addresses come from webheroAdmin({ routes, homeSlug }), which the
 * plugin passes in as props. Styles: .cms-view-switch and .cms-grid, which
 * also hide the table while Grid is on.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useConfig, useListDrawerContext, useListQuery, usePreferences } from "@payloadcms/ui";
import { DEFAULT_HOME_SLUG, DEFAULT_ROUTES, publicPath, type SiteRoutes } from "../routes.js";

type View = "list" | "grid";

/** Pages load at this width so a tile shows the desktop layout, then scale down. */
const PAGE_WIDTH = 1440;
const PAGE_HEIGHT = (PAGE_WIDTH * 3) / 4;

type GridDoc = {
  id: number | string;
  title?: string | null;
  filename?: string | null;
  alt?: string | null;
  decorative?: boolean | null;
  mimeType?: string | null;
  url?: string | null;
  thumbnailURL?: string | null;
  filesize?: number | null;
  sizes?: { thumbnail?: { url?: string | null } | null } | null;
  slug?: string | null;
  path?: string | null;
  _status?: string | null;
  /** Payload's list wording: "changed" means live, with unpublished edits. */
  _displayStatus?: string | null;
};

/** On the website now, whether or not it also has unpublished changes. */
function isLive(doc: GridDoc): boolean {
  return doc._status === "published" || doc._displayStatus === "changed";
}

/** Bytes as an editor would say them: "0.9 MB", not "930965". */
function readableSize(bytes: number | null | undefined): string | null {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} bytes`;
  const kb = bytes / 1024;
  return kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`;
}

function isGraphic(doc: GridDoc): boolean {
  return doc.mimeType === "image/png" || doc.mimeType === "image/svg+xml";
}

function mediaImage(doc: GridDoc): string | null {
  if (doc.mimeType && !doc.mimeType.startsWith("image/")) return null;
  const thumb = doc.sizes?.thumbnail?.url ?? doc.thumbnailURL ?? null;
  return isGraphic(doc) ? (doc.url ?? thumb) : (thumb ?? doc.url ?? null);
}

/** Where a tile loads the live page from. */
function tileUrl(routes: SiteRoutes, homeSlug: string, collectionSlug: string, doc: GridDoc): string | null {
  return publicPath(routes, homeSlug, collectionSlug, doc);
}

function labelOf(doc: GridDoc): string {
  return doc.title || doc.filename || String(doc.id);
}

export function ListGridSwitch({
  collectionSlug,
  defaultView = "list",
  routes = DEFAULT_ROUTES,
  homeSlug = DEFAULT_HOME_SLUG,
}: {
  collectionSlug: string;
  defaultView?: View;
  /** Passed in by the webheroAdmin plugin. */
  routes?: SiteRoutes;
  homeSlug?: string;
}) {
  const { data } = useListQuery();
  const { getPreference, setPreference } = usePreferences();
  const { isInDrawer } = useListDrawerContext();
  const { config } = useConfig();
  const pathname = usePathname();
  const adminRoute = config.routes.admin;
  const key = `collection-${collectionSlug}-view`;
  const [view, setView] = useState<View>(defaultView);
  const gridRef = useRef<HTMLUListElement>(null);
  const docs = useMemo(() => (data?.docs ?? []) as GridDoc[], [data?.docs]);

  // In a picker drawer a tile would open the document instead of choosing it,
  // and a trashed document has no page to show: both keep the table.
  const available = !isInDrawer && !(pathname?.endsWith("/trash") ?? false);
  const grid = available && view === "grid";
  const isMedia = collectionSlug === "media";

  useEffect(() => {
    let active = true;
    void getPreference<View>(key).then((saved) => {
      if (active && (saved === "grid" || saved === "list")) setView(saved);
    });
    return () => {
      active = false;
    };
  }, [getPreference, key]);

  // Each tile is as wide as the window leaves it, so the page inside is
  // rescaled whenever that changes.
  useEffect(() => {
    const list = gridRef.current;
    if (!list) return;
    const fit = () => {
      const thumb = list.querySelector<HTMLElement>(".cms-grid__thumb");
      if (thumb && thumb.clientWidth > 0) {
        list.style.setProperty("--cms-thumb-scale", String(thumb.clientWidth / PAGE_WIDTH));
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(list);
    return () => observer.disconnect();
  }, [grid, docs.length]);

  if (!available) return null;

  const choose = (next: View) => {
    setView(next);
    void setPreference(key, next);
  };

  const tile = (doc: GridDoc) => {
    if (isMedia) {
      const src = mediaImage(doc);
      return src ? (
        // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail from the storage adapter
        <img src={src} alt="" loading="lazy" decoding="async" className={isGraphic(doc) ? "cms-grid__graphic" : undefined} />
      ) : (
        <span className="cms-grid__placeholder">{doc.mimeType?.split("/")[1]?.toUpperCase() ?? "File"}</span>
      );
    }
    const url = isLive(doc) ? tileUrl(routes, homeSlug, collectionSlug, doc) : null;
    if (url) {
      return (
        <iframe
          className="cms-grid__page"
          src={url}
          title={`Preview of ${labelOf(doc)}`}
          width={PAGE_WIDTH}
          height={PAGE_HEIGHT}
          // No scripts in a tile: no analytics events, forms or preview listener.
          sandbox=""
          loading="lazy"
          tabIndex={-1}
          aria-hidden="true"
          scrolling="no"
        />
      );
    }
    return (
      <span className="cms-grid__placeholder" aria-hidden="true">
        {labelOf(doc).slice(0, 1).toUpperCase()}
      </span>
    );
  };

  return (
    <div className="cms-view-switch" data-view={view}>
      <div className="cms-view-switch__buttons" role="group" aria-label="Show as">
        {(["grid", "list"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={view === option}
            className={`cms-view-switch__button${view === option ? " cms-view-switch__button--active" : ""}`}
            onClick={() => choose(option)}
          >
            {option === "list" ? "List" : "Grid"}
          </button>
        ))}
      </div>
      {grid && docs.length > 0 ? (
        <ul className="cms-grid" ref={gridRef}>
          {docs.map((doc) => {
            const path = isMedia ? null : publicPath(routes, homeSlug, collectionSlug, doc);
            const size = isMedia ? readableSize(doc.filesize) : null;
            return (
              <li key={doc.id} className="cms-grid__item">
                <Link href={`${adminRoute}/collections/${collectionSlug}/${doc.id}`} prefetch={false}>
                  <span className="cms-grid__thumb">{tile(doc)}</span>
                  <span className="cms-grid__label">{labelOf(doc)}</span>
                  {path ? <span className="cms-grid__meta">{path}</span> : null}
                  {!isMedia && !isLive(doc) ? (
                    <span className="cms-grid__meta cms-grid__meta--warn">Not published</span>
                  ) : null}
                  {!isMedia && doc._displayStatus === "changed" ? (
                    <span className="cms-grid__meta cms-grid__meta--warn">Unpublished changes</span>
                  ) : null}
                  {size ? <span className="cms-grid__meta">{size}</span> : null}
                  {isMedia && !doc.alt?.trim() && !doc.decorative ? (
                    <span className="cms-grid__meta cms-grid__meta--warn">No alt text</span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
