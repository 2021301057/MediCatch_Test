package com.medicatch.health.config;

import org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy;
import org.hibernate.boot.model.naming.Identifier;
import org.hibernate.engine.jdbc.env.spi.JdbcEnvironment;

/**
 * 기본 CamelCaseToUnderscoresNamingStrategy는 @Column(name = "`siDoCd`")처럼
 * 따옴표로 감싼 이름까지 snake_case로 변환해버린다 (Hibernate 6.4 기준).
 * quoted 이름은 변환 없이 그대로 사용하고, 나머지는 기존과 동일하게 변환한다.
 */
public class QuotedAwarePhysicalNamingStrategy extends CamelCaseToUnderscoresNamingStrategy {

    @Override
    public Identifier toPhysicalTableName(Identifier logicalName, JdbcEnvironment jdbcEnvironment) {
        if (logicalName != null && logicalName.isQuoted()) {
            return logicalName;
        }
        return super.toPhysicalTableName(logicalName, jdbcEnvironment);
    }

    @Override
    public Identifier toPhysicalColumnName(Identifier logicalName, JdbcEnvironment jdbcEnvironment) {
        if (logicalName != null && logicalName.isQuoted()) {
            return logicalName;
        }
        return super.toPhysicalColumnName(logicalName, jdbcEnvironment);
    }
}
