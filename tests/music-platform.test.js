import test from "node:test";
import assert from "node:assert/strict";
import {
    createSongItem,
    normalizeLegacySongItem,
    normalizeMusicPlatformId,
    listMusicPlatforms,
    getMusicPlatform,
    registerMusicPlatform,
} from "../utils/music-platform/index.js";
import { findSongCandidates } from "../utils/kugou.js";

test("normalizeMusicPlatformId aliases and fallback", () => {
    assert.equal(normalizeMusicPlatformId("kugou"), "kugou");
    assert.equal(normalizeMusicPlatformId("酷狗"), "kugou");
    assert.equal(normalizeMusicPlatformId("网易云"), "netease");
    assert.equal(normalizeMusicPlatformId("unknown-platform"), "netease");
    assert.equal(normalizeMusicPlatformId(""), "netease");
});

test("listMusicPlatforms includes built-ins", () => {
    const platforms = listMusicPlatforms();
    assert.ok(platforms.includes("netease"));
    assert.ok(platforms.includes("kugou"));
});

test("createSongItem normalizes providerData and legacy fields", () => {
    const item = createSongItem({
        platform: "kugou",
        songName: "晴天",
        singerName: "周杰伦",
        hash: "ABC",
        albumId: "1",
        albumAudioId: "2",
        cover: "",
    });
    assert.equal(item.platform, "kugou");
    assert.equal(item.sourceType, "song");
    assert.equal(item.type, "song");
    assert.equal(item.cover, "def");
    assert.equal(item.providerData.hash, "ABC");
    assert.equal(item.hash, "ABC");
    assert.equal(item.id, "ABC");
});

test("normalizeLegacySongItem maps old netease redis shape", () => {
    const item = normalizeLegacySongItem({
        id: 123,
        programId: 9,
        songName: "demo",
        singerName: "singer",
        duration: "03:00",
        type: "podcast",
        cover: "def",
    });
    assert.equal(item.platform, "netease");
    assert.equal(item.sourceType, "podcast");
    assert.equal(item.providerData.id, 123);
    assert.equal(item.providerData.programId, 9);
});

test("findSongCandidates prefers data.lists and respects limit", () => {
    const payload = {
        data: {
            lists: [
                { FileHash: "h1", OriSongName: "a", SingerName: "s1", Duration: 100 },
                { FileHash: "h2", OriSongName: "b", SingerName: "s2", Duration: 200 },
                { FileHash: "h3", OriSongName: "c", SingerName: "s3", Duration: 300 },
            ],
        },
    };
    const list = findSongCandidates(payload, 2);
    assert.equal(list.length, 2);
    assert.equal(list[0].FileHash, "h1");
    assert.equal(list[1].FileHash, "h2");
});

test("registerMusicPlatform allows future providers", () => {
    registerMusicPlatform("demo", () => ({
        platform: "demo",
        displayName: "Demo",
        async search() {
            return [createSongItem({ platform: "demo", songName: "x", id: 1 })];
        },
        async resolve(song) {
            return {
                url: "http://example.com/a.mp3",
                audioType: "mp3",
                size: "",
                qualityLabel: "",
                cover: song.cover,
                tags: ["demo"],
                warnings: [],
                card: null,
            };
        },
    }));
    assert.equal(normalizeMusicPlatformId("demo"), "demo");
    const adapter = getMusicPlatform("demo");
    assert.equal(adapter.displayName, "Demo");
});

test("kugou adapter rejects podcast content type via empty search path contract", async () => {
    const adapter = getMusicPlatform("kugou", { apiServer: "http://127.0.0.1:9" });
    assert.equal(adapter.supportsContentType("2"), false);
    const list = await adapter.search("test", { contentType: "2", limit: 5 });
    assert.deepEqual(list, []);
});
