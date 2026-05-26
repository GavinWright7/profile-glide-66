'use strict';

const BASE_LAT = 37.7858;
const BASE_LNG = -122.4064;
const JITTER_METERS = 75;

function randomCoords(context, _events, done) {
  const r = JITTER_METERS * Math.sqrt(Math.random());
  const theta = Math.random() * 2 * Math.PI;
  const deltaLat = (r * Math.cos(theta)) / 111320;
  const deltaLon = (r * Math.sin(theta)) / (111320 * Math.cos((BASE_LAT * Math.PI) / 180));
  context.vars.lat = BASE_LAT + deltaLat;
  context.vars.lng = BASE_LNG + deltaLon;
  context.vars.toggleDiscoverable = Math.random() > 0.5;
  return done();
}

function nextToggle(context, _events, done) {
  context.vars.toggleCounter = (context.vars.toggleCounter || 0) + 1;
  context.vars.toggleDiscoverable = context.vars.toggleCounter % 2 === 1;
  return done();
}

function setTogglePayload(requestParams, context, _ee, next) {
  requestParams.json = {
    isDiscoverable: Boolean(context.vars.toggleDiscoverable),
    latitude: context.vars.lat,
    longitude: context.vars.lng,
  };
  return next();
}

module.exports = {
  randomCoords,
  nextToggle,
  setTogglePayload,
};
