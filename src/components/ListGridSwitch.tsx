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
 * a sandboxed iframe loaded at desktop width and scaled down, or, with
 * `picture`, its first picture (multi-site, where another site's page can't
 * be framed, and big sites); anything else a letter. Every link has prefetch={false}: prefetching rendered an edit page
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

type Ref = GridDoc | number | string | null | undefined;

/**
 * The first picture found along any of `paths` ("gallery.image" looks in
 * every gallery row for an image; "meta.image" in the SEO group).
 */
function pictureOf(doc: GridDoc, paths: string[]): Ref {
  const walk = (value: unknown, keys: string[]): Ref => {
    if (value == null) return null;
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = walk(item, keys);
        if (found != null) return found;
      }
      return null;
    }
    if (!keys.length) return value as Ref;
    return typeof value === "object" ? walk((value as Record<string, unknown>)[keys[0]], keys.slice(1)) : null;
  };
  for (const path of paths) {
    const found = walk(doc, path.split("."));
    if (found != null && found !== "") return found;
  }
  return null;
}

const refId = (ref: Ref): string | null => (ref == null ? null : typeof ref === "object" ? String(ref.id) : String(ref));

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
  picture,
  remember = true,
}: {
  collectionSlug: string;
  defaultView?: View;
  /**
   * Show each page's picture instead of the live page in a frame: the fields
   * to look in, first match wins, e.g. ["gallery.image", "meta.image"]. For
   * big sites, and for multi-site, where a page of another site can't be
   * framed from this domain. One request per page of results.
   */
  picture?: string[];
  /** False: every visit opens on `defaultView`; a switch lasts until the editor leaves the list. */
  remember?: boolean;
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
  const usePictures = !isMedia && Boolean(picture?.length);
  const [pictures, setPictures] = useState<Record<string, GridDoc>>({});

  // The pictures for the tiles on show, fetched once per page of results.
  const pictureIds = useMemo(
    () =>
      usePictures
        ? [...new Set(docs.map((doc) => refId(pictureOf(doc, picture ?? []))).filter((id): id is string => Boolean(id)))].sort().join(",")
        : "",
    [docs, picture, usePictures],
  );
  const apiRoute = config.routes.api;
  useEffect(() => {
    if (!grid || !pictureIds) return;
    const ids = pictureIds.split(",");
    const controller = new AbortController();
    const params = new URLSearchParams({ "where[id][in]": pictureIds, depth: "0", limit: String(ids.length), pagination: "false" });
    fetch(`${apiRoute}/media?${params}`, { credentials: "include", signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { docs?: GridDoc[] } | null) => {
        if (body?.docs) setPictures(Object.fromEntries(body.docs.map((m) => [String(m.id), m])));
      })
      .catch(() => {});
    return () => controller.abort();
  }, [apiRoute, grid, pictureIds]);

  useEffect(() => {
    if (!remember) return;
    let active = true;
    void getPreference<View>(key).then((saved) => {
      if (active && (saved === "grid" || saved === "list")) setView(saved);
    });
    return () => {
      active = false;
    };
  }, [getPreference, key, remember]);

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
    if (remember) void setPreference(key, next);
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
    if (usePictures) {
      const ref = pictureOf(doc, picture ?? []);
      const found = typeof ref === "object" && ref ? ref : pictures[refId(ref) ?? ""];
      const src = found ? mediaImage(found) : null;
      return src ? (
        // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail from the storage adapter
        <img src={src} alt="" loading="lazy" decoding="async" />
      ) : (
        <span className="cms-grid__placeholder" aria-hidden="true">
          {labelOf(doc).slice(0, 1).toUpperCase()}
        </span>
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
