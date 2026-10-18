// Every review sheet under assets-src, imported so the compiler holds each to its type in
// packages/assets (R-ASSET-021, R-ASSET-027): one asset's sheet, its rounds, or a place's sheet.
// A new sheet is added here; the test below fails while one on disk is missing.
import { join } from "node:path";

import type { PlaceReview, Review, ReviewSheet } from "@japacity/assets";
import { describe, expect, test } from "vitest";

import bodeThomasBettingSheet from "../../assets-src/bld/bode-thomas-betting/review.json";
import deiraArcadeASheet from "../../assets-src/bld/deira-arcade/a/review.json";
import deiraArcadeBSheet from "../../assets-src/bld/deira-arcade/b/review.json";
import deiraArcadeCSheet from "../../assets-src/bld/deira-arcade/c/review.json";
import familyHouseSheet from "../../assets-src/bld/family-house/review.json";
import flyoverSpanSheet from "../../assets-src/bld/flyover-span/review.json";
import laptopHouseSheet from "../../assets-src/bld/laptop-house/review.json";
import marketBlockSheet from "../../assets-src/bld/market-block/review.json";
import phonePlazaSheet from "../../assets-src/bld/phone-plaza/review.json";
import plazaSheet from "../../assets-src/bld/plaza/review.json";
import railwayBridgeSheet from "../../assets-src/bld/railway-bridge/review.json";
import ryeLaneTerraceASheet from "../../assets-src/bld/rye-lane-terrace/a/review.json";
import ryeLaneTerraceBSheet from "../../assets-src/bld/rye-lane-terrace/b/review.json";
import shopRowSheet from "../../assets-src/bld/shop-row/review.json";
import stiltHouseSheet from "../../assets-src/bld/stilt-house/review.json";
import terminalFrontSheet from "../../assets-src/bld/terminal-front/review.json";
import nationalStadiumSheet from "../../assets-src/lm/national-stadium/review.json";
import thirdMainlandSpanSheet from "../../assets-src/lm/third-mainland-span/review.json";
import adaSheet from "../../assets-src/people/ada/review.json";
import amakaSheet from "../../assets-src/people/amaka/review.json";
import bayoSheet from "../../assets-src/people/bayo/review.json";
import bisiSheet from "../../assets-src/people/bisi/review.json";
import bodyBustySheet from "../../assets-src/people/body_busty/review.json";
import bodyPlusSetSheet from "../../assets-src/people/body_plus-set/review.json";
import bodyPlusShortBustySheet from "../../assets-src/people/body_plus-short-busty/review.json";
import bodyPlusSheet from "../../assets-src/people/body_plus/review.json";
import bodyRegularSheet from "../../assets-src/people/body_regular/review.json";
import bodySlimShortSheet from "../../assets-src/people/body_slim-short/review.json";
import bodyTallEightSheet from "../../assets-src/people/body_tall-eight/review.json";
import chiefSheet from "../../assets-src/people/chief/review.json";
import controlSheet from "../../assets-src/people/control/review.json";
import corperSheet from "../../assets-src/people/corper/review.json";
import dayoSheet from "../../assets-src/people/dayo/review.json";
import emekaSheet from "../../assets-src/people/emeka/review.json";
import femiSheet from "../../assets-src/people/femi/review.json";
import hawkerASheet from "../../assets-src/people/hawker_a/review.json";
import hawkerBSheet from "../../assets-src/people/hawker_b/review.json";
import hawkerCSheet from "../../assets-src/people/hawker_c/review.json";
import iyaSheet from "../../assets-src/people/iya/review.json";
import kemiSheet from "../../assets-src/people/kemi/review.json";
import kunleSheet from "../../assets-src/people/kunle/review.json";
import musaSheet from "../../assets-src/people/musa/review.json";
import ngoziSheet from "../../assets-src/people/ngozi/review.json";
import nonsoSheet from "../../assets-src/people/nonso/review.json";
import obiSheet from "../../assets-src/people/obi/review.json";
import riderSheet from "../../assets-src/people/rider/review.json";
import sadeSheet from "../../assets-src/people/sade/review.json";
import segunSheet from "../../assets-src/people/segun/review.json";
import tobiSheet from "../../assets-src/people/tobi/review.json";
import tolaniSheet from "../../assets-src/people/tolani/review.json";
import tundeSheet from "../../assets-src/people/tunde/review.json";
import zainabSheet from "../../assets-src/people/zainab/review.json";
import airportLagosPlaceSheet from "../../assets-src/places/airport-lagos/review.json";
import bodeThomasPlaceSheet from "../../assets-src/places/bode-thomas/review.json";
import computerVillagePlaceSheet from "../../assets-src/places/computer-village/review.json";
import deiraPlaceSheet from "../../assets-src/places/deira/review.json";
import familyHousePlaceSheet from "../../assets-src/places/family-house/review.json";
import nationalStadiumPlaceSheet from "../../assets-src/places/national-stadium/review.json";
import ojuelegbaReviewHubSheet from "../../assets-src/places/ojuelegba/review-hub.json";
import ojuelegbaReviewShellSheet from "../../assets-src/places/ojuelegba/review-shell.json";
import partyRoomSheet from "../../assets-src/places/party-room/review.json";
import peckhamPlaceSheet from "../../assets-src/places/peckham/review.json";
import tejuoshoMarketPlaceSheet from "../../assets-src/places/tejuosho-market/review.json";
import thirdMainlandBridgePlaceSheet from "../../assets-src/places/third-mainland-bridge/review.json";
import balesSheet from "../../assets-src/prop/bales/review.json";
import basinsSheet from "../../assets-src/prop/basins/review.json";
import busShelterSheet from "../../assets-src/prop/bus-shelter/review.json";
import canoeSheet from "../../assets-src/prop/canoe/review.json";
import cookingFireSheet from "../../assets-src/prop/cooking-fire/review.json";
import flagMastSheet from "../../assets-src/prop/flag-mast/review.json";
import flagpoleSheet from "../../assets-src/prop/flagpole/review.json";
import marketStallSheet from "../../assets-src/prop/market-stall/review.json";
import parlourSetSheet from "../../assets-src/prop/parlour-set/review.json";
import partySetSheet from "../../assets-src/prop/party-set/review.json";
import plasticChairSheet from "../../assets-src/prop/plastic-chair/review.json";
import repairTableSheet from "../../assets-src/prop/repair-table/review.json";
import trolleySheet from "../../assets-src/prop/trolley/review.json";
import shareSheet from "../../assets-src/share/review.json";
import containerPhonesSheet from "../../assets-src/shop/container-phones/review.json";
import lottoKioskSheet from "../../assets-src/shop/lotto-kiosk/review.json";
import provisionsSheet from "../../assets-src/shop/provisions/review.json";
import abraSheet from "../../assets-src/veh/abra/review.json";
import labourBusSheet from "../../assets-src/veh/labour-bus/review.json";
import taxiSheet from "../../assets-src/veh/taxi/review.json";

import { listFiles } from "./assets-check";
import { REPO_ROOT } from "../repo";

const SHEETS: Record<string, ReviewSheet> = {
  "bld/bode-thomas-betting/review.json": bodeThomasBettingSheet satisfies Review,
  "bld/deira-arcade/a/review.json": deiraArcadeASheet satisfies Review,
  "bld/deira-arcade/b/review.json": deiraArcadeBSheet satisfies Review,
  "bld/deira-arcade/c/review.json": deiraArcadeCSheet satisfies Review,
  "bld/family-house/review.json": familyHouseSheet satisfies Review,
  "bld/flyover-span/review.json": flyoverSpanSheet satisfies Review,
  "bld/laptop-house/review.json": laptopHouseSheet satisfies Review,
  "bld/market-block/review.json": marketBlockSheet satisfies Review,
  "bld/phone-plaza/review.json": phonePlazaSheet satisfies Review,
  "bld/plaza/review.json": plazaSheet satisfies Review,
  "bld/railway-bridge/review.json": railwayBridgeSheet satisfies Review,
  "bld/rye-lane-terrace/a/review.json": ryeLaneTerraceASheet satisfies Review,
  "bld/rye-lane-terrace/b/review.json": ryeLaneTerraceBSheet satisfies Review,
  "bld/shop-row/review.json": shopRowSheet satisfies Review,
  "bld/stilt-house/review.json": stiltHouseSheet satisfies Review,
  "bld/terminal-front/review.json": terminalFrontSheet satisfies Review,
  "lm/national-stadium/review.json": nationalStadiumSheet satisfies Review,
  "lm/third-mainland-span/review.json": thirdMainlandSpanSheet satisfies Review,
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
  "prop/bales/review.json": balesSheet satisfies Review,
  "prop/basins/review.json": basinsSheet satisfies Review,
  "prop/bus-shelter/review.json": busShelterSheet satisfies Review,
  "prop/canoe/review.json": canoeSheet satisfies Review,
  "prop/cooking-fire/review.json": cookingFireSheet satisfies Review,
  "prop/flag-mast/review.json": flagMastSheet satisfies Review,
  "prop/flagpole/review.json": flagpoleSheet satisfies Review,
  "prop/market-stall/review.json": marketStallSheet satisfies Review,
  "prop/parlour-set/review.json": parlourSetSheet satisfies Review,
  "prop/party-set/review.json": partySetSheet satisfies Review,
  "prop/plastic-chair/review.json": plasticChairSheet satisfies Review,
  "prop/repair-table/review.json": repairTableSheet satisfies Review,
  "prop/trolley/review.json": trolleySheet satisfies Review,
  "share/review.json": shareSheet satisfies Review,
  "shop/container-phones/review.json": containerPhonesSheet satisfies Review,
  "shop/lotto-kiosk/review.json": lottoKioskSheet satisfies Review,
  "shop/provisions/review.json": provisionsSheet satisfies Review,
  "veh/abra/review.json": abraSheet satisfies Review,
  "veh/labour-bus/review.json": labourBusSheet satisfies Review,
  "veh/taxi/review.json": taxiSheet satisfies Review,
};

const SOURCE = join(REPO_ROOT, "assets-src");

describe("review sheets", () => {
  test("[R-ASSET-021] given every review sheet under assets-src, when the sheets are listed, then each is imported here and so checked against its type", () => {
    const onDisk = listFiles(SOURCE).filter((path) => /(^|\/)review(-[a-z0-9-]+)?\.json$/.test(path));
    expect(onDisk.length).toBeGreaterThan(40);
    expect(Object.keys(SHEETS).sort()).toEqual(onDisk);
  });
});
