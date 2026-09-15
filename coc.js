import axios from 'axios';

const COC_API_KEY = process.env.COC_API_KEY;

const client = axios.create({
  baseURL: 'https://api.clashofclans.com/v1',
  headers: {
    Authorization: `Bearer ${COC_API_KEY}`,
    Accept: 'application/json'
  }
});

const encodeTag = (tag) => encodeURIComponent(tag.startsWith('#') ? tag : `#${tag}`);

export const fetchClan = (tag) => client.get(`/clans/${encodeTag(tag)}`);
export const fetchPlayer = (tag) => client.get(`/players/${encodeTag(tag)}`);
export const fetchCurrentWar = (tag) => client.get(`/clans/${encodeTag(tag)}/currentwar`);
export const fetchWarLog = (tag) => client.get(`/clans/${encodeTag(tag)}/warlog`);
export const fetchCWLGroup = (tag) => client.get(`/clans/${encodeTag(tag)}/clanwarleague/group`);
