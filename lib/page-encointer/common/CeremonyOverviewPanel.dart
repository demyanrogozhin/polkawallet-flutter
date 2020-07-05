import 'dart:convert';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_mobx/flutter_mobx.dart';
import 'package:polka_wallet/common/components/roundedCard.dart';
import 'package:polka_wallet/common/consts/settings.dart';
import 'package:polka_wallet/page/account/txConfirmPage.dart';
import 'package:polka_wallet/service/substrateApi/api.dart';
import 'package:polka_wallet/store/app.dart';
import 'package:polka_wallet/utils/UI.dart';
import 'package:polka_wallet/utils/format.dart';
import 'package:polka_wallet/utils/i18n/index.dart';
import 'package:polka_wallet/page-encointer/attesting/meetupPage.dart';

import 'package:flutter_map/flutter_map.dart';
import 'package:latlong/latlong.dart';

class CeremonyOverviewPanel extends StatefulWidget {
  CeremonyOverviewPanel(this.store);

  final AppStore store;

  @override
  _CeremonyOverviewPanelState createState() =>
      _CeremonyOverviewPanelState(store);
}

class _CeremonyOverviewPanelState extends State<CeremonyOverviewPanel> {
  _CeremonyOverviewPanelState(this.store);

  final AppStore store;

  String _tab = 'DOT';

  @override
  void initState() {
    // dropdown menu must include chosen cid even if currencies haven't been fetched
    store.encointer.setCurrencyIdentifiers([store.encointer.chosenCid]);
    _refreshData();
    super.initState();
  }

  Future<void> _refreshData() async {
    // refreshed by parent!
    //webApi.encointer.fetchCurrentCeremonyIndex();
    //await webApi.encointer.fetchCurrencyIdentifiers();
    // what follows depends on the above
    webApi.encointer.fetchParticipantIndex();
    webApi.encointer.fetchParticipantCount();
    await webApi.encointer.fetchMeetupIndex();
    // what follows depends on the above
    webApi.encointer.fetchNextMeetupTime();
    webApi.encointer.fetchNextMeetupLocation();
  }

  @override
  Widget build(BuildContext context) {
    final Map dic = I18n.of(context).encointer;
    final int decimals = encointer_token_decimals;
    return Container(
        width: double.infinity,
        child: RoundedCard(
            margin: EdgeInsets.fromLTRB(16, 4, 16, 16),
            padding: EdgeInsets.all(8),
            child: Observer(
              builder: (_) => Column(children: <Widget>[
                Text("ceremony index: " +
                    store.encointer.currentCeremonyIndex.toString()),
                Text("participant index: " +
                    store.encointer.participantIndex.toString()),
                Text("latest block timestamp: " + store.encointer.timeStamp.toString()),
                store.encointer.participantIndex != 0
                    ? Column(children: <Widget>[
                        Text(
                            "You are registered for CID: " +
                                Fmt.currencyIdentifier(
                                    store.encointer.chosenCid),
                            style: TextStyle(color: Colors.green)),
                        Text("Your meetup has index: " +
                            store.encointer.meetupIndex.toString())
                      ])
                    : Text("You are not registered for a ceremony...",
                        style: TextStyle(color: Colors.red)),
                Text("total number of ceremony participants: " +
                    store.encointer.participantCount.toString()),
                Text("Next Ceremony Will Take Place on:"),
                Text(new DateTime.fromMillisecondsSinceEpoch(
                        store.encointer.nextMeetupTime)
                    .toIso8601String())
              ]),
            )));
  }
}
