
// Run: `flutter pub run build_runner build` in order to create/update the *.g.dart
import 'package:json_annotation/json_annotation.dart';

import 'claimOfAttendance.dart';

part 'attestation.g.dart';


// explicit = true as we have nested Json with ClaimOfAttendance
// field rename such that the fields match the ones defined in the runtime
@JsonSerializable(explicitToJson: true, fieldRename: FieldRename.snake)
class Attestation {
  Attestation(this.claim, this.signature, this.public);

  ClaimOfAttendance claim;
  String signature;
  String public;

  factory Attestation.fromJson(Map<String, dynamic> json) =>
      _$AttestationFromJson(json);
  Map<String, dynamic> toJson() =>
      _$AttestationToJson(this);
}