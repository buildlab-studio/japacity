// Every review sheet under models, imported so the compiler holds each to its type in
// packages/assets (assets:blind-reviewer-scores-views, assets:rework-never-scores-lower): one asset's sheet, its rounds, or a place's sheet.
// A new sheet is added here; the test below fails while one on disk is missing.
import { join } from "node:path";

import type { PlaceReview, Review, ReviewSheet } from "@japacity/assets";
import { describe, expect, test } from "vitest";

import bodeThomasBettingSheet from "../../models/buildings/bode-thomas-betting/review.json";
import deiraArcadeASheet from "../../models/buildings/deira-arcade/a/review.json";
import deiraArcadeBSheet from "../../models/buildings/deira-arcade/b/review.json";
import deiraArcadeCSheet from "../../models/buildings/deira-arcade/c/review.json";
import familyHouseSheet from "../../models/buildings/family-house/review.json";
import flyoverSpanSheet from "../../models/buildings/flyover-span/review.json";
import laptopHouseSheet from "../../models/buildings/laptop-house/review.json";
import marketBlockSheet from "../../models/buildings/market-block/review.json";
import phonePlazaSheet from "../../models/buildings/phone-plaza/review.json";
import plazaSheet from "../../models/buildings/plaza/review.json";
import railwayBridgeSheet from "../../models/buildings/railway-bridge/review.json";
import ryeLaneTerraceASheet from "../../models/buildings/rye-lane-terrace/a/review.json";
import ryeLaneTerraceBSheet from "../../models/buildings/rye-lane-terrace/b/review.json";
import shopRowSheet from "../../models/buildings/shop-row/review.json";
import stiltHouseSheet from "../../models/buildings/stilt-house/review.json";
import terminalFrontSheet from "../../models/buildings/terminal-front/review.json";
import nationalStadiumSheet from "../../models/landmarks/national-stadium/review.json";
import thirdMainlandSpanSheet from "../../models/landmarks/third-mainland-span/review.json";
import adaSheet from "../../models/people/ada/review.json";
import amakaSheet from "../../models/people/amaka/review.json";
import bayoSheet from "../../models/people/bayo/review.json";
import bisiSheet from "../../models/people/bisi/review.json";
import bodyBustySheet from "../../models/people/body_busty/review.json";
import bodyPlusSetSheet from "../../models/people/body_plus-set/review.json";
import bodyPlusShortBustySheet from "../../models/people/body_plus-short-busty/review.json";
import bodyPlusSheet from "../../models/people/body_plus/review.json";
import bodyRegularSheet from "../../models/people/body_regular/review.json";
import bodySlimShortSheet from "../../models/people/body_slim-short/review.json";
import bodyTallEightSheet from "../../models/people/body_tall-eight/review.json";
import chiefSheet from "../../models/people/chief/review.json";
import controlSheet from "../../models/people/control/review.json";
import corperSheet from "../../models/people/corper/review.json";
import dayoSheet from "../../models/people/dayo/review.json";
import emekaSheet from "../../models/people/emeka/review.json";
import femiSheet from "../../models/people/femi/review.json";
import hawkerASheet from "../../models/people/hawker_a/review.json";
import hawkerBSheet from "../../models/people/hawker_b/review.json";
import hawkerCSheet from "../../models/people/hawker_c/review.json";
import iyaSheet from "../../models/people/iya/review.json";
import kemiSheet from "../../models/people/kemi/review.json";
import kunleSheet from "../../models/people/kunle/review.json";
import musaSheet from "../../models/people/musa/review.json";
import ngoziSheet from "../../models/people/ngozi/review.json";
import nonsoSheet from "../../models/people/nonso/review.json";
import obiSheet from "../../models/people/obi/review.json";
import riderSheet from "../../models/people/rider/review.json";
import sadeSheet from "../../models/people/sade/review.json";
import segunSheet from "../../models/people/segun/review.json";
import tobiSheet from "../../models/people/tobi/review.json";
import tolaniSheet from "../../models/people/tolani/review.json";
import tundeSheet from "../../models/people/tunde/review.json";
import zainabSheet from "../../models/people/zainab/review.json";
import airportLagosPlaceSheet from "../../models/places/airport-lagos/review.json";
import bodeThomasPlaceSheet from "../../models/places/bode-thomas/review.json";
import computerVillagePlaceSheet from "../../models/places/computer-village/review.json";
import deiraPlaceSheet from "../../models/places/deira/review.json";
import familyHousePlaceSheet from "../../models/places/family-house/review.json";
import nationalStadiumPlaceSheet from "../../models/places/national-stadium/review.json";
import ojuelegbaReviewHubSheet from "../../models/places/ojuelegba/review-hub.json";
import ojuelegbaReviewShellSheet from "../../models/places/ojuelegba/review-shell.json";
import partyRoomSheet from "../../models/places/party-room/review.json";
import peckhamPlaceSheet from "../../models/places/peckham/review.json";
import tejuoshoMarketPlaceSheet from "../../models/places/tejuosho-market/review.json";
import thirdMainlandBridgePlaceSheet from "../../models/places/third-mainland-bridge/review.json";
import balesSheet from "../../models/props/bales/review.json";
import basinsSheet from "../../models/props/basins/review.json";
import busShelterSheet from "../../models/props/bus-shelter/review.json";
import canoeSheet from "../../models/props/canoe/review.json";
import cookingFireSheet from "../../models/props/cooking-fire/review.json";
import flagMastSheet from "../../models/props/flag-mast/review.json";
import flagpoleSheet from "../../models/props/flagpole/review.json";
import marketStallSheet from "../../models/props/market-stall/review.json";
import parlourSetSheet from "../../models/props/parlour-set/review.json";
import partySetSheet from "../../models/props/party-set/review.json";
import plasticChairSheet from "../../models/props/plastic-chair/review.json";
import repairTableSheet from "../../models/props/repair-table/review.json";
import trolleySheet from "../../models/props/trolley/review.json";
import shareSheet from "../../models/share/review.json";
import containerPhonesSheet from "../../models/shopfronts/container-phones/review.json";
import lottoKioskSheet from "../../models/shopfronts/lotto-kiosk/review.json";
import provisionsSheet from "../../models/shopfronts/provisions/review.json";
import abraSheet from "../../models/vehicles/abra/review.json";
import labourBusSheet from "../../models/vehicles/labour-bus/review.json";
import taxiSheet from "../../models/vehicles/taxi/review.json";

import { filesUnder, REPO_ROOT } from "../repo";

const SHEETS: Record<string, ReviewSheet> = {
  "buildings/bode-thomas-betting/review.json": bodeThomasBettingSheet satisfies Review,
  "buildings/deira-arcade/a/review.json": deiraArcadeASheet satisfies Review,
  "buildings/deira-arcade/b/review.json": deiraArcadeBSheet satisfies Review,
  "buildings/deira-arcade/c/review.json": deiraArcadeCSheet satisfies Review,
  "buildings/family-house/review.json": familyHouseSheet satisfies Review,
  "buildings/flyover-span/review.json": flyoverSpanSheet satisfies Review,
  "buildings/laptop-house/review.json": laptopHouseSheet satisfies Review,
  "buildings/market-block/review.json": marketBlockSheet satisfies Review,
  "buildings/phone-plaza/review.json": phonePlazaSheet satisfies Review,
  "buildings/plaza/review.json": plazaSheet satisfies Review,
  "buildings/railway-bridge/review.json": railwayBridgeSheet satisfies Review,
  "buildings/rye-lane-terrace/a/review.json": ryeLaneTerraceASheet satisfies Review,
  "buildings/rye-lane-terrace/b/review.json": ryeLaneTerraceBSheet satisfies Review,
  "buildings/shop-row/review.json": shopRowSheet satisfies Review,
  "buildings/stilt-house/review.json": stiltHouseSheet satisfies Review,
  "buildings/terminal-front/review.json": terminalFrontSheet satisfies Review,
  "landmarks/national-stadium/review.json": nationalStadiumSheet satisfies Review,
  "landmarks/third-mainland-span/review.json": thirdMainlandSpanSheet satisfies Review,
  "people/ada/review.json": adaSheet satisfies Review,
  "people/amaka/review.json": amakaSheet satisfies Review,
  "people/bayo/review.json": bayoSheet satisfies Review,
  "people/bisi/review.json": bisiSheet satisfies Review,
  "people/body_busty/review.json": bodyBustySheet satisfies Review,
  "people/body_plus-set/review.json": bodyPlusSetSheet satisfies Review,
  "people/body_plus-short-busty/review.json": bodyPlusShortBustySheet satisfies Review,
  "people/body_plus/review.json": bodyPlusSheet satisfies Review,
  "people/body_regular/review.json": bodyRegularSheet satisfies Review,
  "people/body_slim-short/review.json": bodySlimShortSheet satisfies Review,
  "people/body_tall-eight/review.json": bodyTallEightSheet satisfies Review,
  "people/chief/review.json": chiefSheet satisfies Review,
  "people/control/review.json": controlSheet satisfies Review,
  "people/corper/review.json": corperSheet satisfies Review,
  "people/dayo/review.json": dayoSheet satisfies Review,
  "people/emeka/review.json": emekaSheet satisfies Review,
  "people/femi/review.json": femiSheet satisfies Review,
  "people/hawker_a/review.json": hawkerASheet satisfies Review,
  "people/hawker_b/review.json": hawkerBSheet satisfies Review,
  "people/hawker_c/review.json": hawkerCSheet satisfies Review,
  "people/iya/review.json": iyaSheet satisfies Review,
  "people/kemi/review.json": kemiSheet satisfies Review,
  "people/kunle/review.json": kunleSheet satisfies Review,
  "people/musa/review.json": musaSheet satisfies Review,
  "people/ngozi/review.json": ngoziSheet satisfies Review,
  "people/nonso/review.json": nonsoSheet satisfies Review,
  "people/obi/review.json": obiSheet satisfies Review,
  "people/rider/review.json": riderSheet satisfies Review,
  "people/sade/review.json": sadeSheet satisfies Review,
  "people/segun/review.json": segunSheet satisfies Review,
  "people/tobi/review.json": tobiSheet satisfies Review,
  "people/tolani/review.json": tolaniSheet satisfies Review,
  "people/tunde/review.json": tundeSheet satisfies Review,
  "people/zainab/review.json": zainabSheet satisfies Review,
  "places/airport-lagos/review.json": airportLagosPlaceSheet satisfies PlaceReview,
  "places/bode-thomas/review.json": bodeThomasPlaceSheet satisfies PlaceReview,
  "places/computer-village/review.json": computerVillagePlaceSheet satisfies PlaceReview,
  "places/deira/review.json": deiraPlaceSheet satisfies PlaceReview,
  "places/family-house/review.json": familyHousePlaceSheet satisfies PlaceReview,
  "places/national-stadium/review.json": nationalStadiumPlaceSheet satisfies PlaceReview,
  "places/ojuelegba/review-hub.json": ojuelegbaReviewHubSheet satisfies PlaceReview,
  "places/ojuelegba/review-shell.json": ojuelegbaReviewShellSheet satisfies PlaceReview,
  "places/party-room/review.json": partyRoomSheet satisfies Review[],
  "places/peckham/review.json": peckhamPlaceSheet satisfies PlaceReview,
  "places/tejuosho-market/review.json": tejuoshoMarketPlaceSheet satisfies PlaceReview,
  "places/third-mainland-bridge/review.json": thirdMainlandBridgePlaceSheet satisfies PlaceReview,
  "props/bales/review.json": balesSheet satisfies Review,
  "props/basins/review.json": basinsSheet satisfies Review,
  "props/bus-shelter/review.json": busShelterSheet satisfies Review,
  "props/canoe/review.json": canoeSheet satisfies Review,
  "props/cooking-fire/review.json": cookingFireSheet satisfies Review,
  "props/flag-mast/review.json": flagMastSheet satisfies Review,
  "props/flagpole/review.json": flagpoleSheet satisfies Review,
  "props/market-stall/review.json": marketStallSheet satisfies Review,
  "props/parlour-set/review.json": parlourSetSheet satisfies Review,
  "props/party-set/review.json": partySetSheet satisfies Review,
  "props/plastic-chair/review.json": plasticChairSheet satisfies Review,
  "props/repair-table/review.json": repairTableSheet satisfies Review,
  "props/trolley/review.json": trolleySheet satisfies Review,
  "share/review.json": shareSheet satisfies Review,
  "shopfronts/container-phones/review.json": containerPhonesSheet satisfies Review,
  "shopfronts/lotto-kiosk/review.json": lottoKioskSheet satisfies Review,
  "shopfronts/provisions/review.json": provisionsSheet satisfies Review,
  "vehicles/abra/review.json": abraSheet satisfies Review,
  "vehicles/labour-bus/review.json": labourBusSheet satisfies Review,
  "vehicles/taxi/review.json": taxiSheet satisfies Review,
};

const SOURCE = join(REPO_ROOT, "models");

describe("review sheets", () => {
  test("[assets:blind-reviewer-scores-views] given every review sheet under models, when the sheets are listed, then each is imported here and so checked against its type", () => {
    const onDisk = filesUnder(SOURCE).filter((path) => /(^|\/)review(-[a-z0-9-]+)?\.json$/.test(path));
    expect(onDisk.length).toBeGreaterThan(40);
    expect(Object.keys(SHEETS).sort()).toEqual(onDisk);
  });
});
