document.write(
"<details class=\"map-encounter-rules\" id=\"world-encounter-rules\"><summary>중립 유닛 등장·개체 수·재등장 규칙 · 19종</summary>\r\n" +
"    <ul class=\"map-encounter-common\">\r\n" +
"      <li>지형·물가·둥지 보호 조건을 따르며, 딱정벌레 외 일반종은 첫 결원부터 주기마다 1마리씩 정원까지 보충한다.</li>\r\n" +
"      <li>일반종 보충은 플레이어 시야 밖의 유효한 빈자리에서 진행하며, 자리가 없으면 보류한다.</li>\r\n" +
"      <li>조건·게임 시간은 월드 공유이며, 어느 부족이 충족해도 적용하고 유니크는 보장 시각까지 각 1마리 등장한다.</li>\r\n" +
"      <li>유니크는 사망 시 재등장하지 않으며, 최초 등장 전 거점이 사라지면 같은 지형 조건의 다른 후보지로 예약을 옮긴다.</li>\r\n" +
"      <li>숨기·퇴각·순회 복귀와 저장·불러오기는 체력·등장 여부·사망 기록·보충 대기 시간을 유지한다.</li>\r\n" +
"    </ul>\r\n" +
"    <div class=\"table-wrap\"><table class=\"map-encounter-rule-table\"><thead><tr><th scope=\"col\">유닛</th><th scope=\"col\">등장 조건</th><th scope=\"col\">개체 수</th><th scope=\"col\">재등장 규칙</th></tr></thead><tbody id=\"map-encounter-rule-rows\"></tbody></table></div>\r\n" +
"  </details>"
);
