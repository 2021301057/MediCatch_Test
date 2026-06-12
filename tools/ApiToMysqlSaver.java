package com.medicatch.health;

import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.StringReader;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.SQLException;

public class ApiToMysqlSaver {

    // DB 접속 정보는 환경변수로 덮어쓸 수 있다 (비밀번호를 코드에 적지 않기 위함)
    // 예: DB_HOST=127.0.0.1 DB_PORT=3307 DB_PASSWORD=실제비밀번호 java ... ApiToMysqlSaver
    private static final String DB_HOST = env("DB_HOST", "localhost");
    private static final String DB_PORT = env("DB_PORT", "3306");
    private static final String DB_NAME = env("DB_NAME", "medicatch_health");
    private static final String DB_URL = "jdbc:mysql://" + DB_HOST + ":" + DB_PORT + "/" + DB_NAME
            + "?useSSL=false"
            + "&serverTimezone=UTC"
            + "&allowPublicKeyRetrieval=true"
            + "&rewriteBatchedStatements=true";
    private static final String DB_USER = env("DB_USER", "root");
    private static final String DB_PASSWORD = env("DB_PASSWORD", "1234");

    private static String env(String key, String defaultValue) {
        String value = System.getenv(key);
        return (value == null || value.isBlank()) ? defaultValue : value;
    }

    private static final String API_BASE_URL = "https://apis.data.go.kr/B550928/HmcSearchService/getRegnHmcList";
    private static final String SERVICE_KEY = "f661ec9068cbd10944c02c9b08505e3b6531c05959ca3e915db2b4b54939d9dd";

    public static void main(String[] args) {
        long startTime = System.currentTimeMillis();

        System.out.println("API 수집 및 DB 저장을 시작합니다.");
        fetchAndSaveData();

        long endTime = System.currentTimeMillis();
        System.out.println("총 소요 시간: " + (endTime - startTime) / 1000.0 + "초");
    }

    public static void fetchAndSaveData() {
        try {
            Class.forName("com.mysql.cj.jdbc.Driver");
        } catch (ClassNotFoundException e) {
            System.err.println("[드라이버 오류] MySQL JDBC 드라이버 클래스를 찾을 수 없습니다.");
            e.printStackTrace();
            return;
        }

        String insertQuery = "INSERT INTO hospitals (siDoCd, siGunGuCd, hmcNm, locAddr, hmcTelNo, cxVl, cyVl) VALUES (?, ?, ?, ?, ?, ?, ?)";
        HttpClient client = HttpClient.newHttpClient();

        try (Connection conn = DriverManager.getConnection(DB_URL, DB_USER, DB_PASSWORD);
             PreparedStatement pstmt = conn.prepareStatement(insertQuery)) {

            conn.setAutoCommit(false);

            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            DocumentBuilder builder = factory.newDocumentBuilder();

            int pageNo = 1;
            int numOfRows = 1000;
            int totalSavedCount = 0;
            boolean hasMoreData = true;

            while (hasMoreData) {
                System.out.println("API 요청 중... (페이지 번호: " + pageNo + ")");

                StringBuilder urlBuilder = new StringBuilder(API_BASE_URL);
                urlBuilder.append("?").append(URLEncoder.encode("serviceKey", StandardCharsets.UTF_8)).append("=").append(SERVICE_KEY);
                urlBuilder.append("&").append(URLEncoder.encode("siDoCd", StandardCharsets.UTF_8)).append("=").append(URLEncoder.encode("", StandardCharsets.UTF_8));
                urlBuilder.append("&").append(URLEncoder.encode("siGunGuCd", StandardCharsets.UTF_8)).append("=").append(URLEncoder.encode("", StandardCharsets.UTF_8));
                urlBuilder.append("&").append(URLEncoder.encode("pageNo", StandardCharsets.UTF_8)).append("=").append(URLEncoder.encode(String.valueOf(pageNo), StandardCharsets.UTF_8));
                urlBuilder.append("&").append(URLEncoder.encode("numOfRows", StandardCharsets.UTF_8)).append("=").append(URLEncoder.encode(String.valueOf(numOfRows), StandardCharsets.UTF_8));

                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(urlBuilder.toString()))
                        .GET()
                        .build();

                HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

                if (response.statusCode() != 200) {
                    System.err.println("[오류] API 연결 실패 (HTTP 오류 코드: " + response.statusCode() + ")");
                    break;
                }

                String xmlBody = response.body();
                Document doc = builder.parse(new InputSource(new StringReader(xmlBody)));
                doc.getDocumentElement().normalize();

                NodeList itemList = doc.getElementsByTagName("item");
                int itemLength = itemList.getLength();

                if (itemLength == 0) {
                    System.out.println("모든 데이터를 수집했습니다. (더 이상 데이터 없음)");
                    hasMoreData = false;
                    break;
                }

                int pageMatchCount = 0;

                for (int i = 0; i < itemLength; i++) {
                    Node node = itemList.item(i);

                    if (node.getNodeType() == Node.ELEMENT_NODE) {
                        Element element = (Element) node;
                        String ykindnm = getTagValue("ykindnm", element);

                        if ("종합병원".equals(ykindnm)) {
                            pstmt.setString(1, getTagValue("siDoCd", element));
                            pstmt.setString(2, getTagValue("siGunGuCd", element));
                            pstmt.setString(3, getTagValue("hmcNm", element));
                            pstmt.setString(4, getTagValue("locAddr", element));
                            pstmt.setString(5, getTagValue("hmcTelNo", element));
                            pstmt.setString(6, getTagValue("cxVl", element));
                            pstmt.setString(7, getTagValue("cyVl", element));

                            pstmt.addBatch();
                            pageMatchCount++;
                            totalSavedCount++;
                        }
                    }
                }

                if (pageMatchCount > 0) {
                    pstmt.executeBatch();
                    pstmt.clearBatch();
                    conn.commit();
                    System.out.println("  -> 이번 페이지에서 " + pageMatchCount + "개의 종합병원 저장 완료.");
                }

                if (itemLength < numOfRows) {
                    System.out.println("마지막 페이지에 도달했습니다.");
                    hasMoreData = false;
                } else {
                    pageNo++;
                }
            }

            System.out.println("최종 완료: 총 " + totalSavedCount + "개의 종합병원 데이터(좌표 포함)가 MySQL에 저장되었습니다.");

        } catch (SQLException e) {
            System.err.println("[DB 오류] " + e.getMessage());
            e.printStackTrace();
        } catch (Exception e) {
            System.err.println("[시스템 오류] " + e.getMessage());
            e.printStackTrace();
        }
    }

    private static String getTagValue(String tag, Element element) {
        NodeList nodeList = element.getElementsByTagName(tag);
        if (nodeList != null && nodeList.getLength() > 0) {
            Node node = nodeList.item(0);
            if (node != null) {
                return node.getTextContent().trim();
            }
        }
        return "";
    }
}
